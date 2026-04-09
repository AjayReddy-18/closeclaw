import type { AgentConfig } from "@closeclaw/shared-types";
import { generateText } from "ai";
import type { ConversationMessage } from "./conversation-types.js";
import {
  AI_ERROR_MESSAGE,
  MAX_RETRIES,
  INITIAL_RETRY_DELAY_MS,
} from "./message-processor-types.js";
import { extractResponseText, retryWithBackoff } from "./ai-retry.js";
import { trimHistory } from "./context-trimmer.js";
import type { createModelProvider } from "./provider-factory.js";
import { buildFullSystemPrompt } from "./system-prompt-builder.js";

export function buildSystemPrompt(
  config: AgentConfig,
  senderIdentity?: string,
  preferenceContext?: string,
  summaryText?: string,
  mcpToolNames?: string[],
): string {
  return buildFullSystemPrompt({
    userCustomPrompt: config.systemPrompt,
    senderIdentity,
    preferenceContext,
    conversationSummary: summaryText,
    mcpToolNames,
  });
}

export function sdkMessagesForGenerate(
  conversation: {
    messages: ConversationMessage[];
    compressedSummary?: { text: string };
  },
  config: AgentConfig,
  preferenceContext?: string,
  senderIdentity?: string,
  mcpToolNames?: string[],
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const systemContent = buildSystemPrompt(
    config,
    senderIdentity,
    preferenceContext,
    conversation.compressedSummary?.text,
    mcpToolNames,
  );
  const systemMsg: ConversationMessage = {
    role: "system",
    content: systemContent,
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

export async function invokeModel(
  conversation: {
    messages: ConversationMessage[];
    compressedSummary?: { text: string };
  },
  gen: typeof generateText,
  model: ReturnType<typeof createModelProvider>,
  config: AgentConfig,
  toolOpts: Record<string, unknown>,
  preferenceContext?: string,
  senderIdentity?: string,
  mcpToolNames?: string[],
): Promise<string> {
  const messages = sdkMessagesForGenerate(
    conversation,
    config,
    preferenceContext,
    senderIdentity,
    mcpToolNames,
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
