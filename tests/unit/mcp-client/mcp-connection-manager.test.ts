import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConnectionManager,
  type ConnectionManagerDeps,
} from "../../../packages/mcp-client/src/mcp-connection-manager.js";
import type {
  HttpServerConfig,
  StdioServerConfig,
} from "../../../packages/mcp-client/src/mcp-config-types.js";

function httpConfig(name: string): HttpServerConfig {
  return {
    name,
    type: "http",
    url: `http://localhost/${name}`,
    headers: {},
    enabled: true,
  };
}

function stdioConfig(name: string): StdioServerConfig {
  return {
    name,
    type: "stdio",
    command: "npx",
    args: [],
    env: {},
    enabled: true,
  };
}

function mockClient(tools: Record<string, unknown>) {
  return {
    tools: vi.fn().mockResolvedValue(tools),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function createMockDeps(
  clientFactory: (...args: unknown[]) => unknown = () =>
    mockClient({ default_tool: {} }),
): ConnectionManagerDeps {
  return {
    createMCPClient: vi.fn().mockImplementation(() =>
      Promise.resolve(clientFactory()),
    ) as never,
    createTransport: vi.fn().mockReturnValue({ type: "sse", url: "mock" }),
  };
}

describe("createConnectionManager", () => {
  let deps: ConnectionManagerDeps;

  beforeEach(() => {
    deps = createMockDeps();
  });

  it("connects to all servers and discovers tools", async () => {
    const client = mockClient({ search: {}, create: {} });
    deps = createMockDeps(() => client);
    const manager = createConnectionManager(deps);
    const results = await manager.connectAll([httpConfig("jira")]);
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe("connected");
    expect(results[0]?.toolCount).toBe(2);
  });

  it("namespaces tools with server__tool format", async () => {
    const client = mockClient({ search: { execute: vi.fn() } });
    deps = createMockDeps(() => client);
    const manager = createConnectionManager(deps);
    await manager.connectAll([httpConfig("jira")]);
    const tools = manager.getAllTools();
    expect(Object.keys(tools)).toContain("jira__search");
  });

  it("handles connection failure gracefully", async () => {
    deps.createMCPClient = vi.fn().mockRejectedValue(
      new Error("Connection refused"),
    ) as never;
    const manager = createConnectionManager(deps);
    const results = await manager.connectAll([httpConfig("broken")]);
    expect(results[0]?.status).toBe("failed");
    expect(results[0]?.error).toContain("Connection refused");
    expect(results[0]?.toolCount).toBe(0);
  });

  it("merges tools from multiple connected servers", async () => {
    let callCount = 0;
    deps = createMockDeps(() => {
      callCount++;
      if (callCount === 1) return mockClient({ search: {} });
      return mockClient({ list_alerts: {} });
    });
    const manager = createConnectionManager(deps);
    await manager.connectAll([httpConfig("jira"), httpConfig("datadog")]);
    const tools = manager.getAllTools();
    expect(Object.keys(tools)).toEqual([
      "jira__search",
      "datadog__list_alerts",
    ]);
  });

  it("excludes failed server tools from getAllTools", async () => {
    let callCount = 0;
    deps.createMCPClient = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockClient({ ok_tool: {} }));
      return Promise.reject(new Error("fail"));
    }) as never;
    const manager = createConnectionManager(deps);
    await manager.connectAll([httpConfig("good"), httpConfig("bad")]);
    const tools = manager.getAllTools();
    expect(Object.keys(tools)).toEqual(["good__ok_tool"]);
  });

  it("returns status for all connections", async () => {
    let callCount = 0;
    deps.createMCPClient = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(mockClient({ t1: {} }));
      return Promise.reject(new Error("offline"));
    }) as never;
    const manager = createConnectionManager(deps);
    await manager.connectAll([httpConfig("ok"), httpConfig("fail")]);
    const statuses = manager.getStatus();
    expect(statuses).toHaveLength(2);
    expect(statuses[0]?.status).toBe("connected");
    expect(statuses[1]?.status).toBe("failed");
  });

  it("closes all connected clients", async () => {
    const client = mockClient({});
    deps = createMockDeps(() => client);
    const manager = createConnectionManager(deps);
    await manager.connectAll([httpConfig("s1"), httpConfig("s2")]);
    await manager.closeAll();
    expect(client.close).toHaveBeenCalledTimes(2);
  });

  it("handles stdio configs", async () => {
    const client = mockClient({ read_file: {} });
    deps = createMockDeps(() => client);
    const manager = createConnectionManager(deps);
    const results = await manager.connectAll([stdioConfig("fs")]);
    expect(results[0]?.status).toBe("connected");
    expect(results[0]?.toolNames).toContain("fs__read_file");
  });
});
