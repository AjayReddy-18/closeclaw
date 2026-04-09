import { describe, it, expect } from "vitest";
import { buildFullSystemPrompt } from "../../../packages/ai-agent/src/system-prompt-builder.js";

describe("buildFullSystemPrompt", () => {
  it("always includes identity section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).toContain("CloseClaw");
    expect(prompt).toContain("personal automation assistant");
  });

  it("always includes response style section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).toContain("Response Style");
    expect(prompt).toContain("Never start with");
  });

  it("always includes platform awareness section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).toContain("Platform Awareness");
  });

  it("always includes tool usage section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).toContain("Tool Usage");
    expect(prompt).toContain("proactively");
  });

  it("always includes scheduling behavior section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).toContain("Scheduling Behavior");
    expect(prompt).toContain("TASK_COMPLETE");
    expect(prompt).toContain("TASK_IN_PROGRESS");
  });

  it("prepends user custom prompt as owner instructions", () => {
    const prompt = buildFullSystemPrompt({
      userCustomPrompt: "Be extra helpful",
    });
    expect(prompt).toMatch(/^Owner Instructions/);
    expect(prompt).toContain("Be extra helpful");
  });

  it("handles empty user prompt without owner section", () => {
    const prompt = buildFullSystemPrompt({ userCustomPrompt: "" });
    expect(prompt).not.toContain("Owner Instructions");
  });

  it("handles undefined user prompt without owner section", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).not.toContain("Owner Instructions");
  });

  it("injects sender identity", () => {
    const prompt = buildFullSystemPrompt({
      senderIdentity: "Talking to: Ajay (telegram:123)",
    });
    expect(prompt).toContain("Talking to: Ajay");
  });

  it("injects preference context", () => {
    const prompt = buildFullSystemPrompt({
      preferenceContext: "User preferences:\n- response_style: brief",
    });
    expect(prompt).toContain("response_style: brief");
  });

  it("injects conversation summary", () => {
    const prompt = buildFullSystemPrompt({
      conversationSummary: "Previously discussed stock markets",
    });
    expect(prompt).toContain("Conversation history summary");
    expect(prompt).toContain("Previously discussed stock markets");
  });

  it("replaces platform placeholder when platform is provided", () => {
    const prompt = buildFullSystemPrompt({ platform: "Telegram" });
    expect(prompt).toContain("Telegram");
  });

  it("includes MCP integrations section when mcpToolNames provided", () => {
    const prompt = buildFullSystemPrompt({
      mcpToolNames: [
        "jira__search_issues",
        "jira__create_issue",
        "datadog__list_alerts",
      ],
    });
    expect(prompt).toContain("MCP Integrations");
    expect(prompt).toContain("jira: search_issues, create_issue");
    expect(prompt).toContain("datadog: list_alerts");
  });

  it("omits MCP section when mcpToolNames is empty", () => {
    const prompt = buildFullSystemPrompt({ mcpToolNames: [] });
    expect(prompt).not.toContain("MCP Integrations");
  });

  it("omits MCP section when mcpToolNames is undefined", () => {
    const prompt = buildFullSystemPrompt({});
    expect(prompt).not.toContain("MCP Integrations");
  });
});
