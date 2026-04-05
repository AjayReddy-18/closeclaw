import type { ConversationMessage } from "./conversation-types.js";

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function trimHistory(
  messages: ConversationMessage[],
  maxTokens: number,
): ConversationMessage[] {
  if (messages.length === 0) return [];

  const systemMessages = messages.filter((m) => m.role === "system");
  const nonSystemMessages = messages.filter((m) => m.role !== "system");

  let systemTokens = 0;
  for (const msg of systemMessages) {
    systemTokens += estimateTokens(msg.content);
  }

  const availableTokens = maxTokens - systemTokens;
  if (availableTokens <= 0) return systemMessages;

  const result: ConversationMessage[] = [];
  let usedTokens = 0;

  for (let i = nonSystemMessages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(nonSystemMessages[i].content);
    if (usedTokens + tokens > availableTokens) break;
    result.unshift(nonSystemMessages[i]);
    usedTokens += tokens;
  }

  return [...systemMessages, ...result];
}
