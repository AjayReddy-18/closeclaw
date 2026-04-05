import { type AgentConfig } from "@closeclaw/shared-types";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";

export function createModelProvider(config: AgentConfig): LanguageModelV1 {
  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: config.apiKey! })(config.model);
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey! })(config.model);
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey! })(config.model);
    case "ollama":
      return createOpenAI({
        baseURL: `${config.baseUrl}/v1`,
        apiKey: "ollama",
      })(config.model);
    case "kimi":
      return createOpenAI({ baseURL: KIMI_BASE_URL, apiKey: config.apiKey! })(
        config.model,
      );
    case "custom":
      return createOpenAI({
        baseURL: config.baseUrl!,
        apiKey: config.apiKey ?? "",
      })(config.model);
  }
}
