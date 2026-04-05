import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Configuration } from "@closeclaw/shared-types";
import { DEFAULT_SYSTEM_PROMPT, DmPolicy } from "@closeclaw/shared-types";
import {
  createAgentSystemPromptDeps,
  runAgentSystemPrompt,
  type AgentSystemPromptDeps,
} from "../../../packages/cli/src/commands/agent-system-prompt.js";
import { ConfigReadError } from "../../../packages/cli/src/config/config-reader.js";

describe("runAgentSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function gateway() {
    return {
      bindAddress: "127.0.0.1",
      port: 18790,
      authToken: "a".repeat(64),
    };
  }

  function baseAgent() {
    return {
      provider: "openai" as const,
      model: "gpt-4",
      apiKey: "sk-test",
      systemPrompt: "Custom assistant prompt.",
      maxContextTokens: 8192,
      tools: {
        enabled: false,
        allowedTools: [] as const,
        maxCallDepth: 10,
        timeoutMs: 30_000,
      },
    };
  }

  function baseConfig(over: Partial<Configuration> = {}): Configuration {
    return {
      version: "0.1.0",
      lastModified: new Date().toISOString(),
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "t",
          enabled: true,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: new Date().toISOString(),
        },
      },
      gateway: gateway(),
      ...over,
    };
  }

  function deps(
    over: Partial<AgentSystemPromptDeps> = {},
  ): AgentSystemPromptDeps {
    return {
      configPath: "/tmp/cfg.json",
      readConfig: vi.fn(() => baseConfig({ agent: baseAgent() })),
      writeConfig: vi.fn(),
      input: vi.fn(async () => "new prompt text"),
      select: vi.fn(async () => "edit"),
      log: vi.fn(),
      ...over,
    };
  }

  it("when no agent configured, logs error and does not prompt", async () => {
    const d = deps({
      readConfig: vi.fn(() => baseConfig({ agent: undefined })),
    });
    await runAgentSystemPrompt(d);
    expect(d.log).toHaveBeenCalledWith(
      "No AI agent configured. Run 'closeclaw agent configure' first.",
    );
    expect(d.select).not.toHaveBeenCalled();
    expect(d.input).not.toHaveBeenCalled();
  });

  it("when agent has custom prompt, logs current prompt and asks edit or keep", async () => {
    const agent = baseAgent();
    const d = deps({
      readConfig: vi.fn(() => baseConfig({ agent })),
      select: vi.fn(async () => "keep"),
    });
    await runAgentSystemPrompt(d);
    expect(d.log).toHaveBeenCalledWith(
      `Current system prompt: "${agent.systemPrompt}"`,
    );
    expect(d.select).toHaveBeenCalledWith({
      message: "What would you like to do?",
      choices: [
        { name: "Edit system prompt", value: "edit" },
        { name: "Keep current prompt", value: "keep" },
      ],
    });
  });

  it("when user keeps existing prompt, does not save", async () => {
    const d = deps({
      select: vi.fn(async () => "keep"),
    });
    await runAgentSystemPrompt(d);
    expect(d.writeConfig).not.toHaveBeenCalled();
    expect(d.input).not.toHaveBeenCalled();
  });

  it("when user chooses edit, prompts for text and saves config", async () => {
    const cfg = baseConfig({ agent: baseAgent() });
    const d = deps({
      readConfig: vi.fn(() => cfg),
      select: vi.fn(async () => "edit"),
      input: vi.fn(async () => "replaced"),
    });
    await runAgentSystemPrompt(d);
    expect(d.input).toHaveBeenCalledWith({
      message: "Enter new system prompt:",
    });
    expect(d.writeConfig).toHaveBeenCalledTimes(1);
    const written = vi.mocked(d.writeConfig).mock.calls[0]![1];
    expect(written.agent?.systemPrompt).toBe("replaced");
    expect(d.log).toHaveBeenCalledWith("System prompt updated.");
  });

  it("when agent uses default system prompt, can edit and save", async () => {
    const cfg = baseConfig({
      agent: { ...baseAgent(), systemPrompt: DEFAULT_SYSTEM_PROMPT },
    });
    const d = deps({
      readConfig: vi.fn(() => cfg),
      select: vi.fn(async () => "edit"),
      input: vi.fn(async () => "My new default replacement"),
    });
    await runAgentSystemPrompt(d);
    expect(d.input).toHaveBeenCalled();
    expect(d.writeConfig).toHaveBeenCalledTimes(1);
    expect(vi.mocked(d.writeConfig).mock.calls[0]![1].agent?.systemPrompt).toBe(
      "My new default replacement",
    );
  });

  it("exits with 130 on ExitPromptError", async () => {
    const { ExitPromptError } = await import("@inquirer/core");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`exit:${String(code)}`);
    });
    const d = deps({
      select: vi.fn(async () => {
        throw new ExitPromptError();
      }),
    });
    await expect(runAgentSystemPrompt(d)).rejects.toThrow("exit:130");
    exitSpy.mockRestore();
  });

  it("logs ConfigReadError and returns without prompting", async () => {
    const errSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const d = deps({
      readConfig: vi.fn(() => {
        throw new ConfigReadError("bad config");
      }),
    });
    await runAgentSystemPrompt(d);
    expect(errSpy).toHaveBeenCalledWith("bad config");
    expect(d.select).not.toHaveBeenCalled();
    expect(d.input).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

describe("createAgentSystemPromptDeps", () => {
  it("returns readConfig and writeConfig from config modules", async () => {
    const d = createAgentSystemPromptDeps();
    expect(d.configPath).toContain(".closeclaw");
    expect(d.configPath).toContain("config.json");
    expect(typeof d.readConfig).toBe("function");
    expect(typeof d.writeConfig).toBe("function");
    expect(typeof d.input).toBe("function");
    expect(typeof d.select).toBe("function");
    expect(typeof d.log).toBe("function");
  });
});
