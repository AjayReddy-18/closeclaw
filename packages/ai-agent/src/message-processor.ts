import type { BotPlatform, AgentConfig } from "@closeclaw/shared-types";
import { generateText, stepCountIs } from "ai";
import type { ConversationMessage } from "./conversation-types.js";
import type { ConversationStore } from "./conversation-types.js";
import type { MessageProcessor } from "./message-processor-types.js";
import {
  CLEAR_COMMAND,
  CLEAR_CONFIRMATION,
  AI_ERROR_MESSAGE,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
} from "./message-processor-types.js";
import { extractResponseText, retryWithBackoff } from "./ai-retry.js";
import { trimHistory, estimateTokens } from "./context-trimmer.js";
import { createModelProvider } from "./provider-factory.js";
import { buildToolMap } from "./tool-executor.js";
import type { PreferenceStore } from "./preference-store.js";
import { formatPreferencesForContext } from "./preference-injection.js";
import {
  createSavePreferenceTool,
  createForgetPreferenceTool,
} from "./tools/preference-tools.js";

function toolOptionsForGenerate(
  config: AgentConfig,
  prefStore?: PreferenceStore,
  platform?: BotPlatform,
  senderId?: string,
) {
  const tools = buildToolMap(config.tools);
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
  if (Object.keys(tools).length === 0) return {};
  return { tools, stopWhen: stepCountIs(config.tools.maxCallDepth) };
}

export interface CreateMessageProcessorDeps {
  agentConfig: AgentConfig;
  conversationStore: ConversationStore;
  generate?: typeof generateText;
  onAfterResponse?: (platform: BotPlatform, senderId: string) => void;
  preferenceStore?: PreferenceStore;
}

export function createMessageProcessor(
  deps: CreateMessageProcessorDeps,
): MessageProcessor {
  const { agentConfig, conversationStore, preferenceStore } = deps;
  const gen = deps.generate ?? generateText;
  const model = createModelProvider(agentConfig);
  const afterHook = deps.onAfterResponse;

  async function process(
    platform: BotPlatform,
    senderId: string,
    text: string,
    senderDisplayName?: string,
  ): Promise<string> {
    const toolOpts = toolOptionsForGenerate(
      agentConfig,
      preferenceStore,
      platform,
      senderId,
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

function sdkMessagesForGenerate(
  conversation: {
    messages: ConversationMessage[];
    compressedSummary?: { text: string };
  },
  config: AgentConfig,
  preferenceContext?: string,
  senderIdentity?: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const systemParts = [config.systemPrompt];
  if (senderIdentity) systemParts.push(senderIdentity);
  if (preferenceContext) systemParts.push(`\n${preferenceContext}`);
  if (conversation.compressedSummary?.text) {
    systemParts.push(
      `\nConversation history summary:\n${conversation.compressedSummary.text}`,
    );
  }
  const systemMsg: ConversationMessage = {
    role: "system",
    content: systemParts.join(""),
    timestamp: new Date(),
  };
  const trimmed = trimHistory(
    [systemMsg, ...conversation.messages],
    config.maxContextTokens,
  );
  return trimmed.map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));
}

async function generateWithRetry(
  gen: typeof generateText,
  args: Parameters<typeof generateText>[0],
): Promise<Awaited<ReturnType<typeof generateText>>> {
  return retryWithBackoff(() => gen(args), MAX_RETRIES, INITIAL_RETRY_DELAY_MS);
}

function pushAssistantMessage(
  conversation: { messages: ConversationMessage[] },
  content: string,
): void {
  conversation.messages.push({
    role: "assistant",
    content,
    timestamp: new Date(),
  });
}

async function invokeModel(
  conversation: {
    messages: ConversationMessage[];
    compressedSummary?: { text: string };
  },
  gen: typeof generateText,
  model: ReturnType<typeof createModelProvider>,
  config: AgentConfig,
  toolOpts: ReturnType<typeof toolOptionsForGenerate>,
  preferenceContext?: string,
  senderIdentity?: string,
): Promise<string> {
  const messages = sdkMessagesForGenerate(
    conversation,
    config,
    preferenceContext,
    senderIdentity,
  );
  const args = {
    model,
    messages,
    ...toolOpts,
  } as Parameters<typeof generateText>[0];
  try {
    const result = await generateWithRetry(gen, args);
    const responseText = extractResponseText(result);
    pushAssistantMessage(conversation, responseText);
    return responseText;
  } catch (error) {
    console.error("[ai-agent] generateText failed:", error);
    return AI_ERROR_MESSAGE;
  }
}
