import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { BotPlatform } from "@closeclaw/shared-types";
import type { Configuration } from "@closeclaw/shared-types";
import {
  createAgentConversationsDeps,
  runAgentConversations,
  type AgentConversationsDeps,
} from "../../../packages/cli/src/commands/agent-conversations.js";

function sampleConfig(
  overrides?: Partial<Configuration["gateway"]>,
): Configuration {
  return {
    version: "1.0.0",
    lastModified: new Date().toISOString(),
    channels: {},
    gateway: {
      bindAddress: "127.0.0.1",
      port: 8765,
      authToken: "x".repeat(64),
      ...overrides,
    },
  };
}

describe("runAgentConversations", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    fetchMock = vi.fn();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  function deps(
    readConfig: AgentConversationsDeps["readConfig"],
  ): AgentConversationsDeps {
    return {
      configPath: join("/tmp", "cfg.json"),
      readConfig,
      fetch: fetchMock as unknown as typeof fetch,
      log: (...args: unknown[]) => logSpy(...args),
    };
  }

  it("logs when no configuration found", async () => {
    await runAgentConversations(deps(() => null));
    expect(logSpy).toHaveBeenCalledWith(
      "No configuration found. Run 'closeclaw onboard' first.",
    );
  });

  it("logs when conversations list is empty", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    await runAgentConversations(deps(() => sampleConfig()));
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8765/agent/conversations",
      expect.objectContaining({
        headers: { Authorization: `Bearer ${"x".repeat(64)}` },
      }),
    );
    expect(logSpy).toHaveBeenCalledWith("No active conversations.");
  });

  it("formats table when conversations are returned", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          platform: BotPlatform.TELEGRAM,
          senderId: "id-1",
          senderDisplayName: "Sam",
          messageCount: 3,
          lastActivityAt: "2026-04-01T12:00:00.000Z",
        },
      ],
    });
    await runAgentConversations(deps(() => sampleConfig()));
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.some((l) => l.includes("Active Conversations"))).toBe(true);
    expect(lines.some((l) => l.includes("Platform"))).toBe(true);
    expect(lines.some((l) => l.includes("Sam"))).toBe(true);
    expect(lines.some((l) => l.includes("3"))).toBe(true);
  });

  it("logs when gateway is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("econnrefused"));
    await runAgentConversations(deps(() => sampleConfig()));
    expect(logSpy).toHaveBeenCalledWith(
      "Cannot connect to gateway. Is it running?",
    );
  });

  it("logs when response is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
    });
    await runAgentConversations(deps(() => sampleConfig()));
    expect(logSpy).toHaveBeenCalledWith(
      "Failed to fetch conversations:",
      "Forbidden",
    );
  });
});

describe("createAgentConversationsDeps", () => {
  it("returns default deps shape", () => {
    const d = createAgentConversationsDeps();
    expect(d.configPath).toContain(".closeclaw");
    expect(d.configPath.endsWith("config.json")).toBe(true);
    expect(typeof d.fetch).toBe("function");
    expect(d.log).toBe(console.log);
    expect(typeof d.readConfig).toBe("function");
  });
});
