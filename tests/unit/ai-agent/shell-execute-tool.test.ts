import { describe, it, expect } from "vitest";

describe("createShellExecuteTool", () => {
  async function loadModule() {
    return import("../../../packages/ai-agent/src/tools/shell-execute-tool.js");
  }

  it("executes a simple command and returns output", async () => {
    const { createShellExecuteTool } = await loadModule();
    const tool = createShellExecuteTool();
    const result = await tool.execute(
      { command: "echo hello" },
      {
        toolCallId: "t",
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello");
  });

  it("returns non-zero exit code for failing command", async () => {
    const { createShellExecuteTool } = await loadModule();
    const tool = createShellExecuteTool();
    const result = await tool.execute(
      { command: "exit 42", workingDirectory: undefined },
      {
        toolCallId: "t",
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );
    expect(result.exitCode).not.toBe(0);
  });
});
