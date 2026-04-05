import type { BotPlatform } from "@closeclaw/shared-types";
import { generateText } from "ai";
import type { LanguageModelV2 } from "@ai-sdk/provider";
import type {
  ConversationFileMessage,
  PreferenceEntry,
} from "./persistence-types.js";
import type { PreferenceStore } from "./preference-store.js";

export interface MemoryFlusher {
  flush(
    platform: BotPlatform,
    senderId: string,
    messages: ConversationFileMessage[],
  ): Promise<PreferenceEntry[]>;
}

const FLUSH_PROMPT = [
  "Analyze the conversation messages below.",
  "Extract any durable personal facts, preferences, or decisions.",
  'Return a JSON array of objects with "key" and "value" fields.',
  "If no preferences are found, return an empty array [].",
  "Return ONLY valid JSON, nothing else.",
].join(" ");

function buildFlushContent(messages: ConversationFileMessage[]): string {
  return messages.map((m) => `[${m.role}]: ${m.content}`).join("\n");
}

function parsePreferences(text: string): PreferenceEntry[] {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isKeyValuePair).map(toPreferenceEntry);
  } catch {
    return [];
  }
}

function isKeyValuePair(item: unknown): item is { key: string; value: string } {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return typeof obj.key === "string" && typeof obj.value === "string";
}

function toPreferenceEntry(pair: {
  key: string;
  value: string;
}): PreferenceEntry {
  return {
    key: pair.key,
    value: pair.value,
    updatedAt: new Date().toISOString(),
  };
}

export function createMemoryFlusher(
  prefStore: PreferenceStore,
  model?: LanguageModelV2,
  gen?: typeof generateText,
): MemoryFlusher {
  const generate = gen ?? generateText;

  async function flush(
    platform: BotPlatform,
    senderId: string,
    messages: ConversationFileMessage[],
  ): Promise<PreferenceEntry[]> {
    try {
      const result = await generate({
        messages: [
          { role: "system", content: FLUSH_PROMPT },
          { role: "user", content: buildFlushContent(messages) },
        ],
        ...(model ? { model } : {}),
      } as Parameters<typeof generateText>[0]);
      const entries = parsePreferences(result.text ?? "");
      for (const entry of entries) {
        prefStore.upsertPreference(platform, senderId, entry.key, entry.value);
      }
      return entries;
    } catch {
      return [];
    }
  }

  return { flush };
}
