import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AgentConfig } from "@closeclaw/shared-types";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_TOOL_CONFIG,
} from "@closeclaw/shared-types";
import {
  createOpenAI,
  createAnthropic,
  createGoogleGenerativeAI,
} from "@ai-sdk/openai";
import { createModelProvider } from "../../../packages/ai-agent/src/provider-factory.js";

function agentBase(
  overrides: Pick<AgentConfig, "provider" | "model"> &
    Partial<Omit<AgentConfig, "provider" | "model">>,
): AgentConfig {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    tools: { ...DEFAULT_TOOL_CONFIG },
    ...overrides,
  };
}

describe("createModelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("openai: passes apiKey to createOpenAI and model to the inner factory", () => {
    const config = agentBase({
      provider: "openai",
      model: "gpt-4o",
      apiKey: "sk-test",
    });
    createModelProvider(config);
    expect(createOpenAI).toHaveBeenCalledWith({ apiKey: "sk-test" });
    const inner = vi.mocked(createOpenAI).mock.results[0]!.value as (
      m: string,
    ) => unknown;
    expect(inner).toHaveBeenCalledWith("gpt-4o");
  });

  it("anthropic: passes apiKey to createAnthropic and model to inner factory", () => {
    const config = agentBase({
      provider: "anthropic",
      model: "claude-3",
      apiKey: "anthropic-key",
    });
    createModelProvider(config);
    expect(createAnthropic).toHaveBeenCalledWith({ apiKey: "anthropic-key" });
    const inner = vi.mocked(createAnthropic).mock.results[0]!.value as (
      m: string,
    ) => unknown;
    expect(inner).toHaveBeenCalledWith("claude-3");
  });

  it("google: passes apiKey to createGoogleGenerativeAI and model to inner factory", () => {
    const config = agentBase({
      provider: "google",
      model: "gemini-pro",
      apiKey: "google-key",
    });
    createModelProvider(config);
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: "google-key",
    });
    const inner = vi.mocked(createGoogleGenerativeAI).mock.results[0]!
      .value as (m: string) => unknown;
    expect(inner).toHaveBeenCalledWith("gemini-pro");
  });

  it("ollama: uses createOpenAI with localhost base URL and placeholder apiKey", () => {
    const config = agentBase({
      provider: "ollama",
      model: "llama3",
      baseUrl: "http://localhost:11434",
    });
    createModelProvider(config);
    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "http://localhost:11434/v1",
      apiKey: "ollama",
    });
    const inner = vi.mocked(createOpenAI).mock.results[0]!.value as (
      m: string,
    ) => unknown;
    expect(inner).toHaveBeenCalledWith("llama3");
  });

  it("kimi: uses Moonshot base URL and apiKey", () => {
    const config = agentBase({
      provider: "kimi",
      model: "moonshot-v1-8k",
      apiKey: "kimi-key",
    });
    createModelProvider(config);
    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://api.moonshot.ai/v1",
      apiKey: "kimi-key",
    });
    const inner = vi.mocked(createOpenAI).mock.results[0]!.value as (
      m: string,
    ) => unknown;
    expect(inner).toHaveBeenCalledWith("moonshot-v1-8k");
  });

  it("custom: passes baseUrl and apiKey when key is set", () => {
    const config = agentBase({
      provider: "custom",
      model: "m",
      baseUrl: "https://api.example/v1",
      apiKey: "custom-key",
    });
    createModelProvider(config);
    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://api.example/v1",
      apiKey: "custom-key",
    });
  });

  it("custom: uses empty apiKey when omitted", () => {
    const config = agentBase({
      provider: "custom",
      model: "m",
      baseUrl: "https://api.example/v1",
    });
    createModelProvider(config);
    expect(createOpenAI).toHaveBeenCalledWith({
      baseURL: "https://api.example/v1",
      apiKey: "",
    });
  });
});
