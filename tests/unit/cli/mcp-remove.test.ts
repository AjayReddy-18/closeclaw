import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runMcpRemove } from "../../../packages/cli/src/commands/mcp-remove.js";
import {
  addServer,
  removeServer,
} from "../../../packages/mcp-client/src/mcp-config-writer.js";

describe("runMcpRemove", () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "mcp-remove-"));
    configPath = join(tempDir, ".closeclaw", "mcp.json");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes existing server and logs success", () => {
    addServer(configPath, "jira", {
      type: "http",
      url: "http://localhost/mcp",
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    runMcpRemove("jira", { configPath, removeServer });
    expect(logSpy).toHaveBeenCalledWith('Server "jira" removed.');
    logSpy.mockRestore();
  });

  it("logs error for non-existent server", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    runMcpRemove("missing", { configPath, removeServer });
    expect(errorSpy).toHaveBeenCalledWith('Server "missing" not found.');
    errorSpy.mockRestore();
  });
});
