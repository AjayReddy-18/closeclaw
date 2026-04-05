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
    description: "GPT-4o, GPT-4 Turbo, GPT-3.5 Turbo",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  },
  anthropic: {
    name: "Anthropic Claude",
    description: "Claude Sonnet, Claude Haiku, Claude Opus",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: [
      "claude-sonnet-4-20250514",
      "claude-3-5-haiku-20241022",
      "claude-opus-4-20250514",
    ],
  },
  google: {
    name: "Google Gemini",
    description: "Gemini 2.0 Flash, Gemini 1.5 Pro",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: ["gemini-2.0-flash", "gemini-1.5-pro"],
  },
  ollama: {
    name: "Ollama (Local)",
    description: "Run models locally — Llama, Mistral, Codellama, etc.",
    requiresApiKey: false,
    requiresBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    exampleModels: ["llama3.2", "mistral", "codellama"],
  },
  kimi: {
    name: "Kimi (Moonshot AI)",
    description: "Moonshot models via OpenAI-compatible API",
    requiresApiKey: true,
    requiresBaseUrl: false,
    exampleModels: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
  },
  custom: {
    name: "Custom (OpenAI-Compatible)",
    description: "Any provider exposing an OpenAI-compatible endpoint",
    requiresApiKey: false,
    requiresBaseUrl: true,
    exampleModels: [],
  },
};
