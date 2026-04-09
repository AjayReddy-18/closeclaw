import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import {
  addServer,
  removeServer,
  listServers,
  serverExists,
} from "../../../packages/mcp-client/src/mcp-config-writer.js";

describe("mcp-config-writer", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-writer-"));
    configPath = join(tempDir, ".closeclaw", "mcp.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("addServer", () => {
    it("creates config file if missing", () => {
      addServer(configPath, "jira", {
        type: "http",
        url: "http://localhost:8000/mcp",
      });
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.mcpServers.jira).toMatchObject({
        type: "http",
        url: "http://localhost:8000/mcp",
      });
    });

    it("adds to existing config", () => {
      addServer(configPath, "first", {
        type: "stdio",
        command: "npx",
      });
      addServer(configPath, "second", {
        type: "http",
        url: "http://localhost/mcp",
      });
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(Object.keys(raw.mcpServers)).toEqual(["first", "second"]);
    });

    it("replaces existing server entry", () => {
      addServer(configPath, "jira", {
        type: "http",
        url: "http://old-url/mcp",
      });
      addServer(configPath, "jira", {
        type: "http",
        url: "http://new-url/mcp",
      });
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(raw.mcpServers.jira.url).toBe("http://new-url/mcp");
    });
  });

  describe("removeServer", () => {
    it("removes existing server and returns true", () => {
      addServer(configPath, "jira", {
        type: "http",
        url: "http://localhost/mcp",
      });
      const removed = removeServer(configPath, "jira");
      expect(removed).toBe(true);
      const raw = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(raw.mcpServers).toEqual({});
    });

    it("returns false for non-existent server", () => {
      addServer(configPath, "jira", {
        type: "http",
        url: "http://localhost/mcp",
      });
      expect(removeServer(configPath, "missing")).toBe(false);
    });
  });

  describe("listServers", () => {
    it("returns empty list when no config file", () => {
      expect(listServers(configPath)).toEqual([]);
    });

    it("lists all servers with details", () => {
      mkdirSync(dirname(configPath), { recursive: true });
      writeFileSync(
        configPath,
        JSON.stringify({
          mcpServers: {
            jira: {
              type: "http",
              url: "http://localhost:8000/mcp",
              enabled: true,
            },
            fs: {
              type: "stdio",
              command: "npx",
              args: ["-y", "pkg"],
              enabled: false,
            },
          },
        }),
      );
      const list = listServers(configPath);
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        name: "jira",
        type: "http",
        detail: "http://localhost:8000/mcp",
        enabled: true,
      });
      expect(list[1]).toEqual({
        name: "fs",
        type: "stdio",
        detail: "npx -y pkg",
        enabled: false,
      });
    });

    it("defaults enabled to true when absent", () => {
      addServer(configPath, "test", {
        type: "http",
        url: "http://localhost/mcp",
      });
      const list = listServers(configPath);
      expect(list[0]?.enabled).toBe(true);
    });
  });

  describe("serverExists", () => {
    it("returns true for existing server", () => {
      addServer(configPath, "jira", {
        type: "http",
        url: "http://localhost/mcp",
      });
      expect(serverExists(configPath, "jira")).toBe(true);
    });

    it("returns false for non-existent server", () => {
      expect(serverExists(configPath, "missing")).toBe(false);
    });
  });
});
