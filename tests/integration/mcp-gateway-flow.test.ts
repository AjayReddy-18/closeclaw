import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { loadMcpConfig } from "../../packages/mcp-client/src/mcp-config-loader.js";
import {
  createConnectionManager,
  type ConnectionManagerDeps,
} from "../../packages/mcp-client/src/mcp-connection-manager.js";

function mockClient(tools: Record<string, unknown>) {
  return {
    tools: vi.fn().mockResolvedValue(tools),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDeps(
  clientFactory: () => unknown,
): ConnectionManagerDeps {
  return {
    createMCPClient: vi.fn().mockImplementation(() =>
      Promise.resolve(clientFactory()),
    ) as never,
    createTransport: vi.fn().mockReturnValue({ type: "sse", url: "mock" }),
  };
}

describe("MCP gateway flow integration", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-gw-"));
    configPath = join(tempDir, ".closeclaw", "mcp.json");
    mkdirSync(dirname(configPath), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads config, connects to servers, and merges tools", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          jira: { type: "http", url: "http://localhost:8000/mcp" },
          datadog: { type: "http", url: "http://localhost:8004/mcp" },
        },
      }),
    );
    let callCount = 0;
    const deps = createMockDeps(() => {
      callCount++;
      if (callCount === 1) return mockClient({ search_issues: {}, create_issue: {} });
      return mockClient({ list_alerts: {} });
    });

    const configs = loadMcpConfig(configPath);
    expect(configs).toHaveLength(2);

    const manager = createConnectionManager(deps);
    const results = await manager.connectAll(configs);
    expect(results.every((r) => r.status === "connected")).toBe(true);

    const allTools = manager.getAllTools();
    expect(Object.keys(allTools)).toEqual([
      "jira__search_issues",
      "jira__create_issue",
      "datadog__list_alerts",
    ]);

    await manager.closeAll();
  });

  it("gracefully degrades when one server fails", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          healthy: { type: "http", url: "http://localhost:8000/mcp" },
          broken: { type: "http", url: "http://localhost:9999/mcp" },
        },
      }),
    );
    let callCount = 0;
    const deps: ConnectionManagerDeps = {
      createMCPClient: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(mockClient({ good_tool: {} }));
        return Promise.reject(new Error("ECONNREFUSED"));
      }) as never,
      createTransport: vi.fn().mockReturnValue({ type: "sse", url: "mock" }),
    };

    const configs = loadMcpConfig(configPath);
    const manager = createConnectionManager(deps);
    const results = await manager.connectAll(configs);

    expect(results[0]?.status).toBe("connected");
    expect(results[1]?.status).toBe("failed");

    const tools = manager.getAllTools();
    expect(Object.keys(tools)).toEqual(["healthy__good_tool"]);

    await manager.closeAll();
  });

  it("operates with no config file", async () => {
    const configs = loadMcpConfig(join(tempDir, "nonexistent.json"));
    expect(configs).toEqual([]);
    const deps = createMockDeps(() => mockClient({}));
    const manager = createConnectionManager(deps);
    const results = await manager.connectAll(configs);
    expect(results).toEqual([]);
    expect(manager.getAllTools()).toEqual({});
  });

  it("skips disabled servers", async () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          active: { type: "http", url: "http://localhost/mcp" },
          disabled: { type: "http", url: "http://localhost/mcp2", enabled: false },
        },
      }),
    );
    const configs = loadMcpConfig(configPath);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe("active");
  });
});
