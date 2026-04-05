import { generateText } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { ConversationFileMessage } from "./persistence-types.js";

export interface ConversationCompressor {
  shouldCompress(messageCount: number): boolean;
  compress(
    messages: ConversationFileMessage[],
    existingSummary?: string,
  ): Promise<string>;
}

function buildPrompt(
  messages: ConversationFileMessage[],
  existingSummary?: string,
): string {
  const parts: string[] = [];
  if (existingSummary) {
    parts.push(`Previous summary:\n${existingSummary}\n`);
  }
  parts.push("Conversation to summarize:");
  for (const m of messages) {
    parts.push(`[${m.role}]: ${m.content}`);
  }
  return parts.join("\n");
}

const SYSTEM_INSTRUCTION = [
  "Summarize the conversation below into a concise paragraph.",
  "Preserve all key facts, decisions, preferences, and context.",
  "If a previous summary is provided, merge it with the new messages.",
  "Return only the summary text, nothing else.",
].join(" ");

export function createConversationCompressor(
  threshold: number,
  _keepRecentCount: number,
  model?: LanguageModelV2,
  gen?: typeof generateText,
): ConversationCompressor {
  const generate = gen ?? generateText;

  function shouldCompress(messageCount: number): boolean {
    return messageCount > threshold;
  }

  async function compress(
    messages: ConversationFileMessage[],
    existingSummary?: string,
  ): Promise<string> {
    const prompt = buildPrompt(messages, existingSummary);
    const args: Parameters<typeof generateText>[0] = {
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        { role: "user", content: prompt },
      ],
      ...(model ? { model } : {}),
    } as Parameters<typeof generateText>[0];
    const result = await generate(args);
    return result.text ?? "";
  }

  return { shouldCompress, compress };
}
