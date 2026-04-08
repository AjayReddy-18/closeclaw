import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadMcpConfig } from "../../../packages/mcp-client/src/mcp-config-loader.js";

describe("loadMcpConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when file does not exist", () => {
    const result = loadMcpConfig(join(tempDir, "nonexistent.json"));
    expect(result).toEqual([]);
  });

  it("loads and normalizes valid config", () => {
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          jira: { type: "http", url: "http://localhost:8000/mcp" },
          fs: { type: "stdio", command: "npx", args: ["-y", "pkg"] },
        },
      }),
    );
    const result = loadMcpConfig(configPath);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ name: "jira", type: "http" });
    expect(result[1]).toMatchObject({ name: "fs", type: "stdio" });
  });

  it("filters out disabled servers", () => {
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          active: { type: "http", url: "http://localhost/mcp" },
          disabled: {
            type: "http",
            url: "http://localhost/mcp2",
            enabled: false,
          },
        },
      }),
    );
    const result = loadMcpConfig(configPath);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("active");
  });

  it("applies env interpolation to http headers", () => {
    process.env["TEST_MCP_TOKEN"] = "secret123";
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          jira: {
            type: "http",
            url: "http://localhost/mcp",
            headers: { Authorization: "Token ${env:TEST_MCP_TOKEN}" },
          },
        },
      }),
    );
    const result = loadMcpConfig(configPath);
    expect(
      result[0]?.type === "http" ? result[0].headers["Authorization"] : "",
    ).toBe("Token secret123");
    delete process.env["TEST_MCP_TOKEN"];
  });

  it("applies env interpolation to stdio env", () => {
    process.env["MY_API_KEY"] = "key456";
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        mcpServers: {
          fs: {
            type: "stdio",
            command: "npx",
            env: { API_KEY: "${env:MY_API_KEY}" },
          },
        },
      }),
    );
    const result = loadMcpConfig(configPath);
    expect(
      result[0]?.type === "stdio" ? result[0].env["API_KEY"] : "",
    ).toBe("key456");
    delete process.env["MY_API_KEY"];
  });

  it("warns and returns empty for malformed JSON", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(configPath, "not-json{{{");
    const result = loadMcpConfig(configPath);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and returns empty for invalid config shape", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const configPath = join(tempDir, "mcp.json");
    writeFileSync(configPath, JSON.stringify({ wrongKey: {} }));
    const result = loadMcpConfig(configPath);
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
