import { describe, it, expect, vi, beforeEach } from "vitest";

const cpMock = vi.hoisted(() => ({
  exec: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  exec: cpMock.exec,
}));

import { createShellExecuteTool } from "../../../../packages/ai-agent/src/tools/shell-execute-tool.js";

describe("createShellExecuteTool", () => {
  beforeEach(() => {
    cpMock.exec.mockReset();
    cpMock.exec.mockImplementation(
      (
        _cmd: string,
        _opts: unknown,
        cb: (err: Error | null, stdout: string, stderr: string) => void,
      ) => {
        cb(null, "hello", "");
      },
    );
  });

  it("returns a tool object with expected structure", () => {
    const t = createShellExecuteTool();
    expect(t.type).toBe("function");
    expect(t.description).toContain("shell");
    expect(t.inputSchema).toBeDefined();
    expect(t.execute).toBeTypeOf("function");
  });

  it("execute resolves stdout stderr exitCode via exec", async () => {
    const t = createShellExecuteTool();
    const out = (await t.execute!({ command: "echo hello" })) as {
      exitCode: number;
      stdout: string;
      stderr: string;
    };
    expect(out.exitCode).toBe(0);
    expect(out.stdout).toBe("hello");
    expect(out.stderr).toBe("");
    expect(cpMock.exec).toHaveBeenCalled();
  });
});
