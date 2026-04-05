import type { BotPlatform, AgentConfig } from "@closeclaw/shared-types";
import { generateText, stepCountIs } from "ai";
import type { ConversationMessage } from "./conversation-types.js";
import type { ConversationStore } from "./conversation-types.js";
import type { MessageProcessor } from "./message-processor-types.js";
import {
  CLEAR_COMMAND,
  CLEAR_CONFIRMATION,
  AI_ERROR_MESSAGE,
  EMPTY_RESPONSE_MESSAGE,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
} from "./message-processor-types.js";
import { trimHistory, estimateTokens } from "./context-trimmer.js";
import { createModelProvider } from "./provider-factory.js";
import { buildToolMap } from "./tool-executor.js";

function toolOptionsForGenerate(config: AgentConfig) {
  const tools = buildToolMap(config.tools);
  if (Object.keys(tools).length === 0) return {};
  return { tools, stopWhen: stepCountIs(config.tools.maxCallDepth) };
}

export interface CreateMessageProcessorDeps {
  agentConfig: AgentConfig;
  conversationStore: ConversationStore;
  generate?: typeof generateText;
}

export function createMessageProcessor(
  deps: CreateMessageProcessorDeps,
): MessageProcessor {
  const { agentConfig, conversationStore } = deps;
  const gen = deps.generate ?? generateText;
  const model = createModelProvider(agentConfig);
  const toolOpts = toolOptionsForGenerate(agentConfig);
  return {
    processMessage: (platform, senderId, text, senderDisplayName) =>
      handleIncomingText(
        agentConfig,
        conversationStore,
        gen,
        model,
        toolOpts,
        platform,
        senderId,
        text,
        senderDisplayName,
      ),
  };
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
  return await invokeModel(c, gen, model, agentConfig, toolOpts);
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

function sdkMessagesForGenerate(
  conversation: { messages: ConversationMessage[] },
  config: AgentConfig,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const systemMsg: ConversationMessage = {
    role: "system",
    content: config.systemPrompt,
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const r = error as Record<string, unknown>;
  const s = r["statusCode"] ?? r["status"];
  return typeof s === "number" ? s : undefined;
}

function isRateLimitError(error: unknown): boolean {
  if (errorStatus(error) === 429) return true;
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return msg.toLowerCase().includes("rate limit");
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelayMs: number,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries && isRateLimitError(error)) {
        await delay(initialDelayMs * Math.pow(2, attempt));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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
  conversation: { messages: ConversationMessage[] },
  gen: typeof generateText,
  model: ReturnType<typeof createModelProvider>,
  config: AgentConfig,
  toolOpts: ReturnType<typeof toolOptionsForGenerate>,
): Promise<string> {
  const messages = sdkMessagesForGenerate(conversation, config);
  const args = {
    model,
    messages,
    ...toolOpts,
  } as Parameters<typeof generateText>[0];
  try {
    const result = await generateWithRetry(gen, args);
    const responseText = result.text || EMPTY_RESPONSE_MESSAGE;
    pushAssistantMessage(conversation, responseText);
    return responseText;
  } catch (error) {
    console.error("[ai-agent] generateText failed:", error);
    return AI_ERROR_MESSAGE;
  }
}
