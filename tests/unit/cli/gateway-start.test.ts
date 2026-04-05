import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BotAdapter } from "@closeclaw/bot-adapters";
import type { AgentConfig, Configuration } from "@closeclaw/shared-types";
import { DEFAULT_TOOL_CONFIG, DmPolicy } from "@closeclaw/shared-types";
import {
  runGatewayStart,
  createGatewayStartDeps,
} from "../../../packages/cli/src/commands/gateway-start.js";
import { ConfigReadError } from "../../../packages/cli/src/config/config-reader.js";

const aiMocks = vi.hoisted(() => {
  const mockStore = { pruneStale: vi.fn(), saveToDisk: vi.fn() };
  return {
    mockStore,
    mockPersistence: {},
    createConversationPersistence: vi.fn(() => ({})),
    createPersistentConversationStore: vi.fn(() => mockStore),
    createMessageProcessor: vi.fn(() => ({
      processMessage: vi.fn().mockResolvedValue("ok"),
    })),
  };
});

vi.mock("@closeclaw/ai-agent", () => ({
  createConversationPersistence: aiMocks.createConversationPersistence,
  createPersistentConversationStore: aiMocks.createPersistentConversationStore,
  createMessageProcessor: aiMocks.createMessageProcessor,
  createPreferenceStore: vi.fn(() => ({})),
}));

function makeAdapter(overrides: Partial<BotAdapter> = {}): BotAdapter {
  return {
    platform: "telegram",
    connect: vi.fn(),
    disconnect: vi.fn(),
    healthCheck: vi.fn(),
    onMessage: vi.fn(),
    sendMessage: vi.fn(),
    sendTypingIndicator: vi.fn(),
    ...overrides,
  };
}

describe("runGatewayStart", () => {
  const sampleConfig: Configuration = {
    version: "0.1.0",
    lastModified: new Date().toISOString(),
    channels: {
      telegram: {
        platform: "telegram",
        botToken: "123456789:Ab_cdefghijklmnop",
        enabled: true,
        dmPolicy: DmPolicy.PAIRING,
        createdAt: new Date().toISOString(),
      },
    },
    gateway: {
      bindAddress: "127.0.0.1",
      port: 18888,
      authToken: "a".repeat(64),
    },
  };

  it("errors when config is missing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runGatewayStart({
      configPath: "/nope.json",
      pairingStorePath: "/p.json",
      readConfig: () => null,
      createAdapter: vi.fn(),
      createGatewayServer: vi.fn(),
      waitForShutdown: async () => undefined,
    });
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("Run closeclaw onboard"),
    );
    err.mockRestore();
  });

  it("connects adapters, starts gateway, and stops on shutdown", async () => {
    const adapter = makeAdapter();
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    const createAdapter = vi.fn(() => adapter);
    const createGatewayServer = vi.fn(() => ({
      start,
      stop,
      address: () => ({ port: 1 }),
    }));
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/pair.json",
      readConfig: () => sampleConfig,
      createAdapter,
      createGatewayServer,
      waitForShutdown: async () => undefined,
    });
    expect(createAdapter).toHaveBeenCalledWith(
      "telegram",
      "123456789:Ab_cdefghijklmnop",
    );
    expect(adapter.connect).toHaveBeenCalled();
    expect(start).toHaveBeenCalled();
    expect(stop).toHaveBeenCalled();
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("logs error and returns when readConfig throws ConfigReadError", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await runGatewayStart({
      configPath: "/bad.json",
      pairingStorePath: "/p.json",
      readConfig: () => {
        throw new ConfigReadError("Malformed JSON in config: /bad.json");
      },
      createAdapter: vi.fn(),
      createGatewayServer: vi.fn(),
      waitForShutdown: async () => undefined,
    });
    expect(err).toHaveBeenCalledWith("Malformed JSON in config: /bad.json");
    err.mockRestore();
  });

  it("rethrows non-ConfigReadError exceptions from readConfig", async () => {
    await expect(
      runGatewayStart({
        configPath: "/c.json",
        pairingStorePath: "/p.json",
        readConfig: () => {
          throw new TypeError("unexpected");
        },
        createAdapter: vi.fn(),
        createGatewayServer: vi.fn(),
        waitForShutdown: async () => undefined,
      }),
    ).rejects.toThrow("unexpected");
  });

  it("skips disabled channels", async () => {
    const configWithDisabled: Configuration = {
      ...sampleConfig,
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "t",
          enabled: false,
          dmPolicy: DmPolicy.PAIRING,
          createdAt: new Date().toISOString(),
        },
        discord: {
          platform: "discord",
          botToken: "d",
          enabled: true,
          dmPolicy: DmPolicy.OPEN,
          createdAt: new Date().toISOString(),
        },
      },
    };
    const adapter = makeAdapter({ platform: "discord" });
    const createAdapter = vi.fn(() => adapter);
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => configWithDisabled,
      createAdapter,
      createGatewayServer: vi.fn(() => ({ start, stop, address: () => null })),
      waitForShutdown: async () => undefined,
    });
    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith("discord", "d");
  });

  it("still disconnects adapters when server stop throws", async () => {
    const adapter = makeAdapter();
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => {
      throw new Error("stop failed");
    });
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => sampleConfig,
      createAdapter: vi.fn(() => adapter),
      createGatewayServer: vi.fn(() => ({ start, stop, address: () => null })),
      waitForShutdown: async () => undefined,
    });
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("swallows disconnect errors during shutdown", async () => {
    const adapter = makeAdapter({
      disconnect: vi.fn(async () => {
        throw new Error("disc fail");
      }),
    });
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => sampleConfig,
      createAdapter: vi.fn(() => adapter),
      createGatewayServer: vi.fn(() => ({ start, stop, address: () => null })),
      waitForShutdown: async () => undefined,
    });
    expect(adapter.disconnect).toHaveBeenCalled();
  });

  it("resolves dmSettings for channels with allowedSenders", async () => {
    const configAllowlist: Configuration = {
      ...sampleConfig,
      channels: {
        telegram: {
          platform: "telegram",
          botToken: "t",
          enabled: true,
          dmPolicy: DmPolicy.ALLOWLIST,
          allowedSenders: ["u1", "u2"],
          createdAt: new Date().toISOString(),
        },
      },
    };
    let capturedSettings: unknown;
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => configAllowlist,
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn((cfg) => {
        capturedSettings = cfg.getDmSettings?.("telegram");
        return { start, stop, address: () => null };
      }),
      waitForShutdown: async () => undefined,
    });
    expect(capturedSettings).toEqual({
      dmPolicy: DmPolicy.ALLOWLIST,
      allowedSenders: ["u1", "u2"],
    });
  });

  it("resolves dmSettings without allowedSenders for non-allowlist policy", async () => {
    let capturedSettings: unknown;
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => sampleConfig,
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn((cfg) => {
        capturedSettings = cfg.getDmSettings?.("telegram");
        return { start, stop, address: () => null };
      }),
      waitForShutdown: async () => undefined,
    });
    expect(capturedSettings).toEqual({ dmPolicy: DmPolicy.PAIRING });
  });

  it("returns OPEN dmPolicy for unconfigured platform", async () => {
    let capturedSettings: unknown;
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => sampleConfig,
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn((cfg) => {
        capturedSettings = cfg.getDmSettings?.("discord");
        return { start, stop, address: () => null };
      }),
      waitForShutdown: async () => undefined,
    });
    expect(capturedSettings).toEqual({ dmPolicy: DmPolicy.OPEN });
  });
});

describe("runGatewayStart AI agent assembly", () => {
  const sampleConfig: Configuration = {
    version: "0.1.0",
    lastModified: new Date().toISOString(),
    channels: {
      telegram: {
        platform: "telegram",
        botToken: "123456789:Ab_cdefghijklmnop",
        enabled: true,
        dmPolicy: DmPolicy.PAIRING,
        createdAt: new Date().toISOString(),
      },
    },
    gateway: {
      bindAddress: "127.0.0.1",
      port: 18888,
      authToken: "a".repeat(64),
    },
  };

  const validAgent: AgentConfig = {
    provider: "ollama",
    model: "llama3",
    baseUrl: "http://127.0.0.1:11434",
    systemPrompt: "hi",
    maxContextTokens: 8192,
    tools: DEFAULT_TOOL_CONFIG,
  };

  beforeEach(() => {
    aiMocks.createConversationPersistence.mockClear();
    aiMocks.createPersistentConversationStore.mockClear();
    aiMocks.createMessageProcessor.mockClear();
  });

  it("creates processor and store and passes them to gateway when agent is valid", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    let gwCfg: unknown;
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => ({ ...sampleConfig, agent: validAgent }),
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn((cfg) => {
        gwCfg = cfg;
        return { start, stop, address: () => null };
      }),
      waitForShutdown: async () => undefined,
    });
    expect(aiMocks.createConversationPersistence).toHaveBeenCalled();
    expect(aiMocks.createPersistentConversationStore).toHaveBeenCalled();
    expect(aiMocks.createMessageProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        agentConfig: validAgent,
        conversationStore: aiMocks.mockStore,
        preferenceStore: expect.any(Object),
        onAfterResponse: expect.any(Function),
      }),
    );
    expect(gwCfg).toMatchObject({
      messageProcessor: expect.objectContaining({
        processMessage: expect.any(Function),
      }),
      conversationStore: aiMocks.mockStore,
    });
    expect(log).toHaveBeenCalledWith("AI agent active: ollama/llama3");
    log.mockRestore();
  });

  it("omits processor when no agent (backward compatible)", async () => {
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    let gwCfg: unknown;
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => sampleConfig,
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn((cfg) => {
        gwCfg = cfg;
        return { start, stop, address: () => null };
      }),
      waitForShutdown: async () => undefined,
    });
    expect(aiMocks.createConversationPersistence).not.toHaveBeenCalled();
    expect(aiMocks.createMessageProcessor).not.toHaveBeenCalled();
    expect(gwCfg).toMatchObject({
      messageProcessor: undefined,
      conversationStore: undefined,
    });
  });

  it("schedules pruning interval and clears it on shutdown", async () => {
    const handle = 42 as unknown as ReturnType<typeof setInterval>;
    const intervalSpy = vi
      .spyOn(globalThis, "setInterval")
      .mockReturnValue(handle);
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const start = vi.fn(async () => undefined);
    const stop = vi.fn(async () => undefined);
    await runGatewayStart({
      configPath: "/c.json",
      pairingStorePath: "/p.json",
      readConfig: () => ({ ...sampleConfig, agent: validAgent }),
      createAdapter: vi.fn(() => makeAdapter()),
      createGatewayServer: vi.fn(() => ({ start, stop, address: () => null })),
      waitForShutdown: async () => undefined,
    });
    expect(intervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      60 * 60 * 1000,
    );
    expect(clearSpy).toHaveBeenCalledWith(handle);
    intervalSpy.mockRestore();
    clearSpy.mockRestore();
  });
});

describe("createGatewayStartDeps", () => {
  it("returns deps with config and pairing store paths", () => {
    const deps = createGatewayStartDeps();
    expect(deps.configPath).toContain(".closeclaw");
    expect(deps.pairingStorePath).toContain(".closeclaw");
    expect(typeof deps.readConfig).toBe("function");
    expect(typeof deps.createAdapter).toBe("function");
    expect(typeof deps.createGatewayServer).toBe("function");
  });
});
