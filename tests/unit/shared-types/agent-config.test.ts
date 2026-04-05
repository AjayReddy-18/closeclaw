import { describe, it, expect } from "vitest";
import {
  AI_PROVIDERS,
  DEFAULT_TOOL_CONFIG,
  requiresApiKey,
  requiresBaseUrl,
  isValidAgentConfig,
  type AiProvider,
} from "@closeclaw/shared-types";

function agentForProvider(provider: AiProvider) {
  const base = {
    model: "m",
    systemPrompt: "s",
    maxContextTokens: 100,
    tools: DEFAULT_TOOL_CONFIG,
  };
  if (requiresApiKey(provider)) {
    return { ...base, provider, apiKey: "k" };
  }
  if (requiresBaseUrl(provider)) {
    return { ...base, provider, baseUrl: "http://localhost" };
  }
  return { ...base, provider };
}

describe("requiresApiKey", () => {
  it("returns true for openai, anthropic, google, kimi", () => {
    expect(requiresApiKey("openai")).toBe(true);
    expect(requiresApiKey("anthropic")).toBe(true);
    expect(requiresApiKey("google")).toBe(true);
    expect(requiresApiKey("kimi")).toBe(true);
  });

  it("returns false for ollama and custom", () => {
    expect(requiresApiKey("ollama")).toBe(false);
    expect(requiresApiKey("custom")).toBe(false);
  });
});

describe("requiresBaseUrl", () => {
  it("returns true for ollama and custom", () => {
    expect(requiresBaseUrl("ollama")).toBe(true);
    expect(requiresBaseUrl("custom")).toBe(true);
  });

  it("returns false for openai, anthropic, google, kimi", () => {
    expect(requiresBaseUrl("openai")).toBe(false);
    expect(requiresBaseUrl("anthropic")).toBe(false);
    expect(requiresBaseUrl("google")).toBe(false);
    expect(requiresBaseUrl("kimi")).toBe(false);
  });
});

describe("isValidAgentConfig", () => {
  it.each(AI_PROVIDERS)("accepts valid config for provider %s", (provider) => {
    expect(isValidAgentConfig(agentForProvider(provider))).toBe(true);
  });

  it("rejects non-object", () => {
    expect(isValidAgentConfig(null)).toBe(false);
  });

  it("rejects missing provider", () => {
    expect(
      isValidAgentConfig({
        model: "m",
        apiKey: "k",
        systemPrompt: "s",
        maxContextTokens: 1,
        tools: DEFAULT_TOOL_CONFIG,
      }),
    ).toBe(false);
  });

  it("rejects cloud provider without apiKey", () => {
    expect(
      isValidAgentConfig({
        provider: "openai",
        model: "m",
        systemPrompt: "s",
        maxContextTokens: 1,
        tools: DEFAULT_TOOL_CONFIG,
      }),
    ).toBe(false);
  });

  it("rejects ollama without baseUrl", () => {
    expect(
      isValidAgentConfig({
        provider: "ollama",
        model: "m",
        systemPrompt: "s",
        maxContextTokens: 1,
        tools: DEFAULT_TOOL_CONFIG,
      }),
    ).toBe(false);
  });

  it("rejects custom without baseUrl", () => {
    expect(
      isValidAgentConfig({
        provider: "custom",
        model: "m",
        systemPrompt: "s",
        maxContextTokens: 1,
        tools: DEFAULT_TOOL_CONFIG,
      }),
    ).toBe(false);
  });

  it("rejects empty model string", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        model: "",
      }),
    ).toBe(false);
  });

  it("rejects maxContextTokens less than 1", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        maxContextTokens: 0,
      }),
    ).toBe(false);
  });

  it("rejects invalid tools sub-object", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        tools: { ...DEFAULT_TOOL_CONFIG, maxCallDepth: 0 },
      }),
    ).toBe(false);
  });

  it("accepts config with compressionThreshold and keepRecentCount", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        compressionThreshold: 50,
        keepRecentCount: 20,
      }),
    ).toBe(true);
  });

  it("accepts config without compression fields (optional)", () => {
    expect(isValidAgentConfig(agentForProvider("openai"))).toBe(true);
  });

  it("rejects compressionThreshold less than 1", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        compressionThreshold: 0,
      }),
    ).toBe(false);
  });

  it("rejects non-number compressionThreshold", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        compressionThreshold: "fifty",
      }),
    ).toBe(false);
  });

  it("rejects keepRecentCount less than 1", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        keepRecentCount: 0,
      }),
    ).toBe(false);
  });

  it("rejects non-number keepRecentCount", () => {
    expect(
      isValidAgentConfig({
        ...agentForProvider("openai"),
        keepRecentCount: "twenty",
      }),
    ).toBe(false);
  });
});
