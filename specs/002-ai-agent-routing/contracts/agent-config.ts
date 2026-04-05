export const AI_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "ollama",
  "kimi",
  "custom",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export const TOOL_NAMES = [
  "datetime",
  "http_request",
  "shell_execute",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export interface ToolConfig {
  enabled: boolean;
  allowedTools: ToolName[];
  maxCallDepth: number;
  timeoutMs: number;
}

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

export const DEFAULT_TOOL_CONFIG: ToolConfig = {
  enabled: false,
  allowedTools: [],
  maxCallDepth: 10,
  timeoutMs: 30_000,
};

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" && AI_PROVIDERS.includes(value as AiProvider)
  );
}

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && TOOL_NAMES.includes(value as ToolName);
}

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

export function isValidToolConfig(value: unknown): value is ToolConfig {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (typeof obj["enabled"] !== "boolean") return false;
  if (!Array.isArray(obj["allowedTools"])) return false;
  if (!obj["allowedTools"].every(isToolName)) return false;
  if (typeof obj["maxCallDepth"] !== "number") return false;
  if (obj["maxCallDepth"] < 1) return false;
  if (typeof obj["timeoutMs"] !== "number") return false;
  if (obj["timeoutMs"] < 1000) return false;
  return true;
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
