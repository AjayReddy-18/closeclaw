import { describe, it, expect } from "vitest";
import {
  isValidStdioEntry,
  isValidHttpEntry,
  isValidServerEntry,
  isValidMcpConfigFile,
  normalizeEntry,
} from "../../../packages/mcp-client/src/mcp-config-types.js";

describe("isValidStdioEntry", () => {
  it("accepts valid stdio config", () => {
    expect(
      isValidStdioEntry({ type: "stdio", command: "npx", args: ["-y", "pkg"] }),
    ).toBe(true);
  });

  it("accepts stdio without optional fields", () => {
    expect(isValidStdioEntry({ type: "stdio", command: "node" })).toBe(true);
  });

  it("rejects missing command", () => {
    expect(isValidStdioEntry({ type: "stdio" })).toBe(false);
  });

  it("rejects empty command", () => {
    expect(isValidStdioEntry({ type: "stdio", command: "" })).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(isValidStdioEntry({ type: "http", command: "npx" })).toBe(false);
  });

  it("rejects non-string args", () => {
    expect(
      isValidStdioEntry({ type: "stdio", command: "npx", args: [123] }),
    ).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidStdioEntry(null)).toBe(false);
    expect(isValidStdioEntry("string")).toBe(false);
  });
});

describe("isValidHttpEntry", () => {
  it("accepts valid http config", () => {
    expect(
      isValidHttpEntry({
        type: "http",
        url: "http://localhost:8000/mcp",
        headers: { Authorization: "Bearer token" },
      }),
    ).toBe(true);
  });

  it("accepts http without optional fields", () => {
    expect(
      isValidHttpEntry({ type: "http", url: "http://localhost/mcp" }),
    ).toBe(true);
  });

  it("rejects missing url", () => {
    expect(isValidHttpEntry({ type: "http" })).toBe(false);
  });

  it("rejects empty url", () => {
    expect(isValidHttpEntry({ type: "http", url: "" })).toBe(false);
  });

  it("rejects wrong type", () => {
    expect(isValidHttpEntry({ type: "stdio", url: "http://x" })).toBe(false);
  });

  it("rejects non-string headers", () => {
    expect(
      isValidHttpEntry({
        type: "http",
        url: "http://x",
        headers: { key: 123 },
      }),
    ).toBe(false);
  });
});

describe("isValidServerEntry", () => {
  it("accepts stdio entry", () => {
    expect(isValidServerEntry({ type: "stdio", command: "node" })).toBe(true);
  });

  it("accepts http entry", () => {
    expect(isValidServerEntry({ type: "http", url: "http://x" })).toBe(true);
  });

  it("rejects unknown type", () => {
    expect(isValidServerEntry({ type: "grpc", url: "x" })).toBe(false);
  });
});

describe("isValidMcpConfigFile", () => {
  it("accepts valid config file", () => {
    const config = {
      mcpServers: {
        jira: { type: "http", url: "http://localhost:8000/mcp" },
        fs: { type: "stdio", command: "npx" },
      },
    };
    expect(isValidMcpConfigFile(config)).toBe(true);
  });

  it("accepts empty mcpServers", () => {
    expect(isValidMcpConfigFile({ mcpServers: {} })).toBe(true);
  });

  it("rejects missing mcpServers", () => {
    expect(isValidMcpConfigFile({})).toBe(false);
  });

  it("rejects null mcpServers", () => {
    expect(isValidMcpConfigFile({ mcpServers: null })).toBe(false);
  });

  it("rejects invalid entry in mcpServers", () => {
    expect(
      isValidMcpConfigFile({ mcpServers: { bad: { type: "unknown" } } }),
    ).toBe(false);
  });

  it("rejects non-object", () => {
    expect(isValidMcpConfigFile(null)).toBe(false);
  });
});

describe("normalizeEntry", () => {
  it("normalizes stdio entry with defaults", () => {
    const result = normalizeEntry("fs", { type: "stdio", command: "npx" });
    expect(result).toEqual({
      name: "fs",
      type: "stdio",
      command: "npx",
      args: [],
      env: {},
      enabled: true,
    });
  });

  it("normalizes http entry with defaults", () => {
    const result = normalizeEntry("jira", {
      type: "http",
      url: "http://localhost/mcp",
    });
    expect(result).toEqual({
      name: "jira",
      type: "http",
      url: "http://localhost/mcp",
      headers: {},
      enabled: true,
    });
  });

  it("preserves explicit enabled=false", () => {
    const result = normalizeEntry("disabled", {
      type: "stdio",
      command: "npx",
      enabled: false,
    });
    expect(result.enabled).toBe(false);
  });

  it("preserves args and env for stdio", () => {
    const result = normalizeEntry("test", {
      type: "stdio",
      command: "node",
      args: ["server.js"],
      env: { KEY: "val" },
    });
    expect(result.type === "stdio" && result.args).toEqual(["server.js"]);
    expect(result.type === "stdio" && result.env).toEqual({ KEY: "val" });
  });

  it("preserves headers for http", () => {
    const result = normalizeEntry("test", {
      type: "http",
      url: "http://x",
      headers: { Auth: "token" },
    });
    expect(result.type === "http" && result.headers).toEqual({ Auth: "token" });
  });
});
