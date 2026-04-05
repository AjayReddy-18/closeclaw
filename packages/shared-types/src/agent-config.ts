import type { AiProvider } from "./ai-provider.js";
import { isAiProvider } from "./ai-provider.js";
import type { ToolConfig } from "./tool-config.js";
import { isValidToolConfig } from "./tool-config.js";

export interface AgentConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt: string;
  maxContextTokens: number;
  tools: ToolConfig;
}

export const DEFAULT_SYSTEM_PROMPT =
  "You are CloseClaw, a helpful AI assistant.";
export const DEFAULT_MAX_CONTEXT_TOKENS = 8192;

export function requiresApiKey(provider: AiProvider): boolean {
  return (
    provider === "openai" ||
    provider === "anthropic" ||
    provider === "google" ||
    provider === "kimi"
  );
}

export function requiresBaseUrl(provider: AiProvider): boolean {
  return provider === "ollama" || provider === "custom";
}

export function isValidAgentConfig(value: unknown): value is AgentConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (!isAiProvider(obj["provider"])) return false;
  if (typeof obj["model"] !== "string" || obj["model"].length === 0)
    return false;
  if (
    requiresApiKey(obj["provider"] as AiProvider) &&
    typeof obj["apiKey"] !== "string"
  )
    return false;
  if (
    requiresBaseUrl(obj["provider"] as AiProvider) &&
    typeof obj["baseUrl"] !== "string"
  )
    return false;
  if (typeof obj["systemPrompt"] !== "string") return false;
  if (typeof obj["maxContextTokens"] !== "number") return false;
  if (obj["maxContextTokens"] < 1) return false;
  if (!isValidToolConfig(obj["tools"])) return false;
  return true;
}
