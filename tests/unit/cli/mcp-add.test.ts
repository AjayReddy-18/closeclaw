import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  runMcpAdd,
  type McpAddDeps,
} from "../../../packages/cli/src/commands/mcp-add.js";
import {
  addServer,
  serverExists,
} from "../../../packages/mcp-client/src/mcp-config-writer.js";

describe("runMcpAdd", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-add-"));
    configPath = join(tempDir, ".closeclaw", "mcp.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  function createDeps(overrides: Partial<McpAddDeps> = {}): McpAddDeps {
    return {
      configPath,
      serverExists,
      addServer,
      promptSelect: vi.fn().mockResolvedValue("http"),
      promptInput: vi.fn().mockResolvedValue(""),
      promptConfirm: vi.fn().mockResolvedValue(true),
      ...overrides,
    };
  }

  it("adds http server with prompts", async () => {
    const promptSelect = vi.fn().mockResolvedValue("http");
    const promptInput = vi
      .fn()
      .mockResolvedValueOnce("http://localhost:8000/mcp")
      .mockResolvedValueOnce("Authorization=Bearer token");
    const deps = createDeps({ promptSelect, promptInput });
    await runMcpAdd("jira", deps);
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(raw.mcpServers.jira).toMatchObject({
      type: "http",
      url: "http://localhost:8000/mcp",
      headers: { Authorization: "Bearer token" },
    });
  });

  it("adds stdio server with prompts", async () => {
    const promptSelect = vi.fn().mockResolvedValue("stdio");
    const promptInput = vi
      .fn()
      .mockResolvedValueOnce("npx")
      .mockResolvedValueOnce("-y,@mcp/server")
      .mockResolvedValueOnce("API_KEY=secret");
    const deps = createDeps({ promptSelect, promptInput });
    await runMcpAdd("fs", deps);
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(raw.mcpServers.fs).toMatchObject({
      type: "stdio",
      command: "npx",
      args: ["-y", "@mcp/server"],
      env: { API_KEY: "secret" },
    });
  });

  it("asks for replacement when name already exists", async () => {
    addServer(configPath, "jira", { type: "http", url: "http://old/mcp" });
    const promptConfirm = vi.fn().mockResolvedValue(true);
    const promptSelect = vi.fn().mockResolvedValue("http");
    const promptInput = vi
      .fn()
      .mockResolvedValueOnce("http://new/mcp")
      .mockResolvedValueOnce("");
    const deps = createDeps({ promptConfirm, promptSelect, promptInput });
    await runMcpAdd("jira", deps);
    expect(promptConfirm).toHaveBeenCalled();
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(raw.mcpServers.jira.url).toBe("http://new/mcp");
  });

  it("cancels when user declines replacement", async () => {
    addServer(configPath, "jira", { type: "http", url: "http://old/mcp" });
    const promptConfirm = vi.fn().mockResolvedValue(false);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const deps = createDeps({ promptConfirm });
    await runMcpAdd("jira", deps);
    expect(logSpy).toHaveBeenCalledWith("Cancelled.");
    logSpy.mockRestore();
  });

  it("creates config file when none exists", async () => {
    const promptSelect = vi.fn().mockResolvedValue("http");
    const promptInput = vi
      .fn()
      .mockResolvedValueOnce("http://localhost/mcp")
      .mockResolvedValueOnce("");
    const deps = createDeps({ promptSelect, promptInput });
    await runMcpAdd("new-server", deps);
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(raw.mcpServers["new-server"]).toBeDefined();
  });
});
