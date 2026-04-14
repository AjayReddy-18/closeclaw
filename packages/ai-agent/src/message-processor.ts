import type { BotPlatform, AgentConfig } from "@closeclaw/shared-types";
import { generateText, stepCountIs } from "ai";
import type { ConversationMessage } from "./conversation-types.js";
import type { ConversationStore } from "./conversation-types.js";
import type {
  MessageProcessor,
  IntermediateResponseFn,
} from "./message-processor-types.js";
import {
  CLEAR_COMMAND,
  CLEAR_CONFIRMATION,
} from "./message-processor-types.js";
import { estimateTokens } from "./context-trimmer.js";
import { createModelProvider } from "./provider-factory.js";
import { buildToolMap } from "./tool-executor.js";
import type { PreferenceStore } from "./preference-store.js";
import { formatPreferencesForContext } from "./preference-injection.js";
import {
  createSavePreferenceTool,
  createForgetPreferenceTool,
} from "./tools/preference-tools.js";
import { invokeModel } from "./ai-invoker.js";

type AnyTool = ReturnType<typeof createSavePreferenceTool>;
type ToolMap = Record<string, AnyTool>;

function toolOptionsForGenerate(
  config: AgentConfig,
  prefStore?: PreferenceStore,
  platform?: BotPlatform,
  senderId?: string,
  extraTools?: ToolMap,
) {
  const tools: ToolMap = buildToolMap(config.tools);
  if (prefStore && platform && senderId) {
    tools["save_preference"] = createSavePreferenceTool(
      prefStore,
      platform,
      senderId,
    );
    tools["forget_preference"] = createForgetPreferenceTool(
      prefStore,
      platform,
      senderId,
    );
  }
  if (extraTools) Object.assign(tools, extraTools);
  if (Object.keys(tools).length === 0) return {};
  return { tools, stopWhen: stepCountIs(config.tools.maxCallDepth) };
}

export interface CreateMessageProcessorDeps {
  agentConfig: AgentConfig;
  conversationStore: ConversationStore;
  generate?: typeof generateText;
  onAfterResponse?: (platform: BotPlatform, senderId: string) => void;
  preferenceStore?: PreferenceStore;
  extraTools?: ToolMap;
  mcpToolNames?: string[];
  hasCursorAgent?: boolean;
  hasOrchestration?: boolean;
  hasWorkflows?: boolean;
}

export function createMessageProcessor(
  deps: CreateMessageProcessorDeps,
): MessageProcessor {
  const { agentConfig, conversationStore, preferenceStore, extraTools } = deps;
  const mcpToolNames = deps.mcpToolNames ?? [];
  const hasCursorAgent = deps.hasCursorAgent ?? false;
  const hasOrchestration = deps.hasOrchestration ?? false;
  const hasWorkflows = deps.hasWorkflows ?? false;
  const gen = deps.generate ?? generateText;
  const model = createModelProvider(agentConfig);
  const afterHook = deps.onAfterResponse;

  async function process(
    platform: BotPlatform,
    senderId: string,
    text: string,
    senderDisplayName?: string,
    onIntermediate?: IntermediateResponseFn,
  ): Promise<string> {
    const toolOpts = toolOptionsForGenerate(
      agentConfig,
      preferenceStore,
      platform,
      senderId,
      extraTools,
    );
    const result = await handleIncomingText(
      agentConfig,
      conversationStore,
      gen,
      model,
      toolOpts,
      platform,
      senderId,
      text,
      senderDisplayName,
      preferenceStore,
      mcpToolNames,
      onIntermediate,
      hasCursorAgent,
      hasOrchestration,
      hasWorkflows,
    );
    if (afterHook) afterHook(platform, senderId);
    return result;
  }

  return { processMessage: process };
}

function rejectionForOversizedInput(
  agentConfig: AgentConfig,
  text: string,
): string | undefined {
  const halfCtx = agentConfig.maxContextTokens * 0.5;
  if (estimateTokens(text) <= halfCtx) return undefined;
  const maxChars = Math.floor(halfCtx * 4);
  return `Your message is too long. Please keep it under ${String(maxChars)} characters.`;
}

async function handleIncomingText(
  agentConfig: AgentConfig,
  conversationStore: ConversationStore,
  gen: typeof generateText,
  model: ReturnType<typeof createModelProvider>,
  toolOpts: ReturnType<typeof toolOptionsForGenerate>,
  platform: BotPlatform,
  senderId: string,
  text: string,
  senderDisplayName?: string,
  prefStore?: PreferenceStore,
  mcpToolNames?: string[],
  onIntermediate?: IntermediateResponseFn,
  hasCursorAgent?: boolean,
  hasOrchestration?: boolean,
  hasWorkflows?: boolean,
): Promise<string> {
  if (text.trim() === CLEAR_COMMAND) {
    conversationStore.clear(platform, senderId);
    return CLEAR_CONFIRMATION;
  }
  const reject = rejectionForOversizedInput(agentConfig, text);
  if (reject !== undefined) return reject;
  const c = conversationStore.getOrCreate(
    platform,
    senderId,
    senderDisplayName,
  );
  appendUserMessage(c, text);
  const prefCtx = prefStore
    ? formatPreferencesForContext(prefStore, platform, senderId)
    : "";
  const identity = buildSenderIdentity(platform, senderId, senderDisplayName);
  return await invokeModel(
    c,
    gen,
    model,
    agentConfig,
    toolOpts,
    prefCtx,
    identity,
    mcpToolNames,
    onIntermediate,
    hasCursorAgent,
    hasOrchestration,
    hasWorkflows,
  );
}

function appendUserMessage(
  conversation: { messages: ConversationMessage[] },
  text: string,
): void {
  conversation.messages.push({
    role: "user",
    content: text,
    timestamp: new Date(),
  });
}

export function buildSenderIdentity(
  platform: BotPlatform,
  senderId: string,
  senderDisplayName?: string,
): string {
  const name = senderDisplayName ?? senderId;
  return `\nCurrent user: ${name} (platform: ${platform}, id: ${senderId})`;
}
