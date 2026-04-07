import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../../packages/ai-agent/src/ai-invoker.js";

describe("buildSystemPrompt", () => {
  it("delegates to buildFullSystemPrompt with correct mapping", () => {
    const config = {
      provider: "anthropic" as const,
      model: "claude-sonnet-4-6",
      systemPrompt: "Custom instructions",
      maxContextTokens: 8192,
      tools: { enabled: false, allowed: [] },
    };
    const prompt = buildSystemPrompt(config, "sender: Ajay", "prefs", "summary");
    expect(prompt).toContain("Owner Instructions");
    expect(prompt).toContain("Custom instructions");
    expect(prompt).toContain("sender: Ajay");
    expect(prompt).toContain("prefs");
    expect(prompt).toContain("summary");
    expect(prompt).toContain("CloseClaw");
  });

  it("always includes built-in prompt even with empty config prompt", () => {
    const config = {
      provider: "anthropic" as const,
      model: "test",
      systemPrompt: "",
      maxContextTokens: 8192,
      tools: { enabled: false, allowed: [] },
    };
    const prompt = buildSystemPrompt(config);
    expect(prompt).toContain("CloseClaw");
    expect(prompt).toContain("Response Style");
    expect(prompt).not.toContain("Owner Instructions");
  });
});
