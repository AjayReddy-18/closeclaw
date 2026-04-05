export const AI_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "ollama",
  "kimi",
  "custom",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export function isAiProvider(value: unknown): value is AiProvider {
  return (
    typeof value === "string" && AI_PROVIDERS.includes(value as AiProvider)
  );
}
