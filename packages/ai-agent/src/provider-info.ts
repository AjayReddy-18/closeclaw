import type { AiProvider } from "@closeclaw/shared-types";

export type ProviderDisplayInfo = {
  name: string;
  description: string;
  requiresApiKey: boolean;
  requiresBaseUrl: boolean;
  defaultBaseUrl?: string;
  exampleModels: string[];
};

export const PROVIDER_INFO: Record<AiProvider, ProviderDisplayInfo> = {
  openai: {
    name: "OpenAI",
    description: "GPT-5.4, GPT-5.4 mini, GPT-5.4 Pro",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: [
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-4o",
      "gpt-4o-mini",
    ],
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Claude Opus 4.6, Claude Sonnet 4.6, Claude Sonnet 4",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: [
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-sonnet-4-20250514",
      "claude-opus-4-20250514",
      "claude-3-5-haiku-20241022",
    ],
  },
  google: {
    name: "Google Gemini",
    description: "Gemini 3.1 Pro, Gemini 3.1 Flash, Gemini 2.5 Pro",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: [
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ],
  },
  ollama: {
    name: "Ollama (Local)",
    description: "Run models locally — Llama 4, Llama 3.3, DeepSeek, etc.",
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    exampleModels: [
      "llama4",
      "llama3.3",
      "llama3.2",
      "deepseek-r1",
      "mistral",
      "gemma2",
      "codellama",
    ],
  },
  kimi: {
    name: "Kimi (Moonshot AI)",
    description: "Kimi K2.5, Kimi K2 Thinking, Kimi Code",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: [
      "kimi-k2.5",
      "kimi-k2-thinking",
      "kimi-k2-turbo",
      "kimi-code",
    ],
  },
  custom: {
    name: "Custom (OpenAI-Compatible)",
    description: "Any provider exposing an OpenAI-compatible endpoint",
    requiresApiKey: false,
    requiresBaseUrl: true,
    exampleModels: [],
  },
};
