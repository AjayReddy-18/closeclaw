import { describe, it, expect, vi } from "vitest";
import {
  runMcpStatus,
  type McpStatusDeps,
} from "../../../packages/cli/src/commands/mcp-status.js";
import type { McpConnectionResult } from "../../../packages/mcp-client/src/mcp-connection-manager.js";

function connectedResult(name: string, toolCount: number): McpConnectionResult {
  return {
    serverName: name,
    status: "connected",
    toolCount,
    toolNames: Array.from(
      { length: toolCount },
      (_, i) => `${name}__tool${String(i)}`,
    ),
    error: undefined,
  };
}

function failedResult(name: string, error: string): McpConnectionResult {
  return {
    serverName: name,
    status: "failed",
    toolCount: 0,
    toolNames: [],
    error,
  };
}

describe("runMcpStatus", () => {
  it("displays connected and failed servers", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deps: McpStatusDeps = {
      loadConfigs: () => [],
      connectAndGetStatus: async () => [
        connectedResult("jira", 5),
        failedResult("broken", "ECONNREFUSED"),
      ],
    };
    await runMcpStatus(deps);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("jira");
    expect(output).toContain("ok");
    expect(output).toContain("5");
    expect(output).toContain("broken");
    expect(output).toContain("FAIL");
    expect(output).toContain("ECONNREFUSED");
    expect(output).toContain("1/2 server(s) connected.");
    logSpy.mockRestore();
  });

  it("displays message when no servers configured", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deps: McpStatusDeps = {
      loadConfigs: () => [],
      connectAndGetStatus: async () => [],
    };
    await runMcpStatus(deps);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("No MCP servers configured.");
    logSpy.mockRestore();
  });

  it("shows tool count for connected servers", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deps: McpStatusDeps = {
      loadConfigs: () => [],
      connectAndGetStatus: async () => [connectedResult("datadog", 12)],
    };
    await runMcpStatus(deps);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("12");
    expect(output).toContain("1/1 server(s) connected.");
    logSpy.mockRestore();
  });
});
