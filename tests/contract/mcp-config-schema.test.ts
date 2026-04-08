import { describe, it, expect } from "vitest";
import {
  isValidMcpConfigFile,
  isValidStdioEntry,
  isValidHttpEntry,
} from "../../packages/mcp-client/src/mcp-config-types.js";

describe("MCP config schema contract", () => {
  describe("stdio server shape", () => {
    it("requires type and command", () => {
      expect(isValidStdioEntry({ type: "stdio", command: "npx" })).toBe(true);
    });

    it("accepts optional args, env, enabled", () => {
      expect(
        isValidStdioEntry({
          type: "stdio",
          command: "npx",
          args: ["-y", "pkg"],
          env: { KEY: "val" },
          enabled: false,
        }),
      ).toBe(true);
    });

    it("rejects if command is missing", () => {
      expect(isValidStdioEntry({ type: "stdio" })).toBe(false);
    });
  });

  describe("http server shape", () => {
    it("requires type and url", () => {
      expect(
        isValidHttpEntry({ type: "http", url: "http://localhost:8000/mcp" }),
      ).toBe(true);
    });

    it("accepts optional headers and enabled", () => {
      expect(
        isValidHttpEntry({
          type: "http",
          url: "http://localhost/mcp",
          headers: { Authorization: "Bearer token" },
          enabled: true,
        }),
      ).toBe(true);
    });

    it("rejects if url is missing", () => {
      expect(isValidHttpEntry({ type: "http" })).toBe(false);
    });
  });

  describe("full config file shape", () => {
    it("accepts Cursor-compatible config format", () => {
      const cursorStyleConfig = {
        mcpServers: {
          "csw-jira": {
            type: "http",
            url: "http://localhost:8000/mcp",
            headers: {
              "X-Jira-Authorization": "Token ${env:MCP_JIRA_TOKEN}",
            },
          },
          filesystem: {
            type: "stdio",
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"],
          },
        },
      };
      expect(isValidMcpConfigFile(cursorStyleConfig)).toBe(true);
    });

    it("accepts empty mcpServers", () => {
      expect(isValidMcpConfigFile({ mcpServers: {} })).toBe(true);
    });

    it("rejects config without mcpServers key", () => {
      expect(isValidMcpConfigFile({ servers: {} })).toBe(false);
    });
  });
});
