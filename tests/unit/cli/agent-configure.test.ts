import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExitPromptError } from "@inquirer/core";
import type { Configuration, AgentConfig } from "@closeclaw/shared-types";
import {
  DEFAULT_MAX_CONTEXT_TOKENS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TOOL_CONFIG,
} from "@closeclaw/shared-types";
import { ConfigReadError } from "../../../packages/cli/src/config/config-reader.js";
import {
  executeAgentConfigure,
  type AgentConfigureDeps,
} from "../../../packages/cli/src/commands/agent-configure-run.js";
import { runAgentConfigure } from "../../../packages/cli/src/commands/agent-configure.js";

function baseConfiguration(over: Partial<Configuration> = {}): Configuration {
  return {
    version: "0.1.0",
    lastModified: "2020-01-01T00:00:00.000Z",
    channels: {},
    gateway: {
      bindAddress: "192.168.1.1",
      port: 8080,
      authToken: "x".repeat(64),
    },
    ...over,
  };
}

function sampleAgent(): AgentConfig {
  return {
    provider: "openai",
    model: "gpt-3",
    apiKey: "old-key",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxContextTokens: DEFAULT_MAX_CONTEXT_TOKENS,
    tools: { ...DEFAULT_TOOL_CONFIG },
  };
}

function baseDeps(over: Partial<AgentConfigureDeps> = {}): AgentConfigureDeps {
  return {
    configPath: "/tmp/closeclaw-test.json",
    readConfig: vi.fn(() => baseConfiguration()),
    writeConfig: vi.fn(),
    select: vi
      .fn()
      .mockResolvedValueOnce("openai")
      .mockResolvedValueOnce("gpt-5.4"),
    input: vi.fn().mockResolvedValue("gpt-5.4"),
    password: vi.fn(async () => "sk-test"),
    confirm: vi.fn().mockResolvedValue(false),
    checkbox: vi.fn(),
    generateText: vi.fn(async () => ({ text: "ok" })),
    createModelProvider: vi.fn(() => ({ mockModel: true })),
    ...over,
  };
}

describe("executeAgentConfigure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: selects provider, picks model from list, validates, saves", async () => {
    const existing = baseConfiguration();
    const deps = baseDeps({
      readConfig: vi.fn(() => existing),
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      confirm: vi.fn().mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.select).toHaveBeenCalledTimes(2);
    expect(deps.password).toHaveBeenCalledWith({ message: "API key" });
    expect(deps.writeConfig).toHaveBeenCalledTimes(1);
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.channels).toEqual(existing.channels);
    expect(written.gateway).toEqual(existing.gateway);
    expect(written.agent?.provider).toBe("openai");
    expect(written.agent?.model).toBe("gpt-5.4");
    expect(written.agent?.apiKey).toBe("sk-test");
  });

  it("model select: choosing custom sentinel falls back to free-text input", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("anthropic")
        .mockResolvedValueOnce("__custom__"),
      input: vi.fn().mockResolvedValue("my-fine-tuned-model"),
      confirm: vi.fn().mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.input).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Model name" }),
    );
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.model).toBe("my-fine-tuned-model");
  });

  it("custom provider: skips model select, uses free-text input directly", async () => {
    const deps = baseDeps({
      select: vi.fn().mockResolvedValueOnce("custom"),
      input: vi
        .fn()
        .mockResolvedValueOnce("my-model")
        .mockResolvedValueOnce("https://api.custom/v1"),
      confirm: vi.fn().mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.select).toHaveBeenCalledTimes(1);
    expect(deps.input).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Model name" }),
    );
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.model).toBe("my-model");
  });

  it("ollama: skips API key, picks model from list, prompts for base URL", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("ollama")
        .mockResolvedValueOnce("llama4"),
      input: vi.fn().mockResolvedValueOnce("http://localhost:11434"),
      confirm: vi.fn().mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.password).not.toHaveBeenCalled();
    expect(deps.input).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Base URL",
        default: "http://localhost:11434",
      }),
    );
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.provider).toBe("ollama");
    expect(written.agent?.model).toBe("llama4");
    expect(written.agent?.baseUrl).toBe("http://localhost:11434");
  });

  it("custom provider via existing test: base URL and no API key", async () => {
    const deps = baseDeps({
      select: vi.fn().mockResolvedValueOnce("custom"),
      input: vi
        .fn()
        .mockResolvedValueOnce("my-model")
        .mockResolvedValueOnce("https://api.custom/v1"),
      confirm: vi.fn().mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.password).not.toHaveBeenCalled();
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.provider).toBe("custom");
    expect(written.agent?.baseUrl).toBe("https://api.custom/v1");
    expect(written.agent?.apiKey).toBeUndefined();
  });

  it("when agent exists and user declines reconfigure, does not write", async () => {
    const deps = baseDeps({
      readConfig: vi.fn(() => baseConfiguration({ agent: sampleAgent() })),
      confirm: vi.fn().mockResolvedValueOnce(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.writeConfig).not.toHaveBeenCalled();
    expect(deps.select).not.toHaveBeenCalled();
  });

  it("when agent exists and user confirms reconfigure, runs full flow", async () => {
    const deps = baseDeps({
      readConfig: vi.fn(() => baseConfiguration({ agent: sampleAgent() })),
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      confirm: vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.select).toHaveBeenCalledTimes(2);
    expect(deps.writeConfig).toHaveBeenCalled();
  });

  it("validation failure then retry succeeds", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      generateText: vi
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce({ text: "ok" }),
      confirm: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false),
    });
    await executeAgentConfigure(deps);
    expect(deps.generateText).toHaveBeenCalledTimes(2);
    expect(deps.writeConfig).toHaveBeenCalled();
  });

  it("tools enabled with shell_execute requires risk confirmation", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      confirm: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true)
        .mockResolvedValue(false),
      checkbox: vi.fn(async () => ["shell_execute"] as const),
    });
    await executeAgentConfigure(deps);
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.tools.enabled).toBe(true);
    expect(written.agent?.tools.allowedTools).toContain("shell_execute");
  });

  it("declining shell risk removes shell_execute from allowed tools", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      confirm: vi
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(false),
      checkbox: vi.fn(async () => ["shell_execute"] as const),
    });
    await executeAgentConfigure(deps);
    const written = vi.mocked(deps.writeConfig).mock.calls[0]![1];
    expect(written.agent?.tools.allowedTools).not.toContain("shell_execute");
  });
});

describe("executeAgentConfigure validation exit", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((code?: number) => {
      throw new Error(`EXIT:${String(code)}`);
    });
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  it("exits when user declines retry after validation failure", async () => {
    const deps = baseDeps({
      select: vi
        .fn()
        .mockResolvedValueOnce("openai")
        .mockResolvedValueOnce("gpt-5.4"),
      generateText: vi.fn(async () => {
        throw new Error("fail");
      }),
      confirm: vi
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false),
    });
    await expect(executeAgentConfigure(deps)).rejects.toThrow("EXIT:1");
    expect(deps.writeConfig).not.toHaveBeenCalled();
  });
});

describe("runAgentConfigure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits 130 on ExitPromptError", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((code?: number) => {
        throw new Error(`EXIT:${String(code)}`);
      });
    const deps = baseDeps({
      select: vi.fn(async () => {
        throw new ExitPromptError("cancelled");
      }),
    });
    await expect(runAgentConfigure(deps)).rejects.toThrow("EXIT:130");
    exitSpy.mockRestore();
  });
});

describe("executeAgentConfigure missing config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns without write when config file missing", async () => {
    const deps = baseDeps({ readConfig: vi.fn(() => null) });
    await executeAgentConfigure(deps);
    expect(deps.writeConfig).not.toHaveBeenCalled();
  });

  it("returns without write on ConfigReadError", async () => {
    const deps = baseDeps({
      readConfig: vi.fn(() => {
        throw new ConfigReadError("bad");
      }),
    });
    await executeAgentConfigure(deps);
    expect(deps.writeConfig).not.toHaveBeenCalled();
  });
});
