import { describe, it, expect } from "vitest";
import { PROVIDER_INFO } from "@closeclaw/ai-agent";
import { AI_PROVIDERS } from "@closeclaw/shared-types";

describe("PROVIDER_INFO", () => {
  it("has entries for all 6 providers", () => {
    expect(Object.keys(PROVIDER_INFO)).toHaveLength(6);
    for (const p of AI_PROVIDERS) {
      expect(PROVIDER_INFO[p]).toBeDefined();
    }
  });

  it("requires API key for openai, anthropic, google, and kimi", () => {
    expect(PROVIDER_INFO.openai.requiresApiKey).toBe(true);
    expect(PROVIDER_INFO.anthropic.requiresApiKey).toBe(true);
    expect(PROVIDER_INFO.google.requiresApiKey).toBe(true);
    expect(PROVIDER_INFO.kimi.requiresApiKey).toBe(true);
  });

  it("requires base URL for ollama and custom", () => {
    expect(PROVIDER_INFO.ollama.requiresBaseUrl).toBe(true);
    expect(PROVIDER_INFO.custom.requiresBaseUrl).toBe(true);
  });

  it("sets Ollama defaultBaseUrl to localhost", () => {
    expect(PROVIDER_INFO.ollama.defaultBaseUrl).toBe("http://localhost:11434");
  });

  it("gives each provider a non-empty name and description", () => {
    for (const p of AI_PROVIDERS) {
      const info = PROVIDER_INFO[p];
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });

  it("gives every provider except custom at least one example model", () => {
    for (const p of AI_PROVIDERS) {
      if (p === "custom") continue;
      expect(PROVIDER_INFO[p].exampleModels.length).toBeGreaterThan(0);
    }
  });

  it("custom provider has an empty exampleModels array", () => {
    expect(PROVIDER_INFO.custom.exampleModels).toEqual([]);
  });

  it("openai includes gpt-4o and gpt-4o-mini", () => {
    expect(PROVIDER_INFO.openai.exampleModels).toContain("gpt-4o");
    expect(PROVIDER_INFO.openai.exampleModels).toContain("gpt-4o-mini");
  });

  it("anthropic includes claude-sonnet-4 and claude-opus-4", () => {
    expect(PROVIDER_INFO.anthropic.exampleModels).toContain(
      "claude-sonnet-4-20250514",
    );
    expect(PROVIDER_INFO.anthropic.exampleModels).toContain(
      "claude-opus-4-20250514",
    );
  });

  it("google includes gemini-2.5-pro and gemini-2.5-flash", () => {
    expect(PROVIDER_INFO.google.exampleModels).toContain("gemini-2.5-pro");
    expect(PROVIDER_INFO.google.exampleModels).toContain("gemini-2.5-flash");
  });

  it("ollama includes llama3.2, deepseek-r1, and gemma2", () => {
    expect(PROVIDER_INFO.ollama.exampleModels).toContain("llama3.2");
    expect(PROVIDER_INFO.ollama.exampleModels).toContain("deepseek-r1");
    expect(PROVIDER_INFO.ollama.exampleModels).toContain("gemma2");
  });
});
