import { describe, it, expect, vi } from "vitest";
import { runMcpList } from "../../../packages/cli/src/commands/mcp-list.js";
import type { ServerListEntry } from "../../../packages/mcp-client/src/mcp-config-writer.js";

describe("runMcpList", () => {
  it("displays table of configured servers", () => {
    const servers: ServerListEntry[] = [
      {
        name: "jira",
        type: "http",
        detail: "http://localhost:8000/mcp",
        enabled: true,
      },
      {
        name: "fs",
        type: "stdio",
        detail: "npx -y @mcp/server",
        enabled: false,
      },
    ];
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runMcpList({ configPath: "/fake", listServers: () => servers });
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("jira");
    expect(output).toContain("http");
    expect(output).toContain("http://localhost:8000/mcp");
    expect(output).toContain("yes");
    expect(output).toContain("fs");
    expect(output).toContain("stdio");
    expect(output).toContain("no");
    expect(output).toContain("2 server(s) configured.");
    logSpy.mockRestore();
  });

  it("displays message when no servers configured", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runMcpList({ configPath: "/fake", listServers: () => [] });
    expect(logSpy).toHaveBeenCalledWith("No MCP servers configured.");
    logSpy.mockRestore();
  });

  it("truncates long names and details", () => {
    const servers: ServerListEntry[] = [
      {
        name: "very-long-server-name-that-exceeds-limit",
        type: "http",
        detail:
          "http://a-very-long-url-that-should-be-truncated-because-it-exceeds-the-max.com/mcp/endpoint",
        enabled: true,
      },
    ];
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runMcpList({ configPath: "/fake", listServers: () => servers });
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("...");
    logSpy.mockRestore();
  });
});
