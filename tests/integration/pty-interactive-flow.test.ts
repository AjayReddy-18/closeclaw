import { describe, it, expect, vi } from "vitest";
import {
  runInteractiveMode,
  stripAnsi,
  detectPtyPermission,
  type PtyHandle,
  type InteractiveRunnerDeps,
} from "@closeclaw/cursor-agent";

function createMockHandle(): PtyHandle & {
  emitData: (data: string) => void;
  emitExit: (code: number) => void;
} {
  let dataCb: ((data: string) => void) | undefined;
  let exitCb: ((info: { exitCode: number }) => void) | undefined;
  return {
    onData(cb) {
      dataCb = cb;
    },
    onExit(cb) {
      exitCb = cb;
    },
    write: vi.fn(),
    kill: vi.fn(),
    emitData(data) {
      dataCb?.(data);
    },
    emitExit(code) {
      exitCb?.({ exitCode: code });
    },
  };
}

describe("PTY interactive flow end-to-end", () => {
  it("streams progress and completes successfully", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
      stripAnsi,
      detectPermission: detectPtyPermission,
    };
    const progress: string[] = [];
    const resultPromise = runInteractiveMode(
      { prompt: "build app", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      (text) => progress.push(text),
      vi.fn(),
    );

    handle.emitData("Reading project structure...\n");
    handle.emitData("Creating src/index.ts...\n");
    handle.emitData("Done!\n");
    handle.emitExit(0);

    const result = await resultPromise;
    expect(result.status).toBe("completed");
    expect(result.outputLog.length).toBeGreaterThanOrEqual(3);
    expect(progress.length).toBeGreaterThan(0);
  });

  it("detects permission prompt and relays decision", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
      stripAnsi,
      detectPermission: detectPtyPermission,
    };
    const onPermission = vi.fn().mockResolvedValue("accept");
    const resultPromise = runInteractiveMode(
      { prompt: "delete files", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      vi.fn(),
      onPermission,
    );

    handle.emitData("About to delete 5 files\n");
    handle.emitData("  Accept  Deny\n");
    await new Promise((r) => setTimeout(r, 50));
    handle.emitData("Files deleted successfully\n");
    handle.emitExit(0);

    const result = await resultPromise;
    expect(result.status).toBe("completed");
    expect(onPermission).toHaveBeenCalled();
    expect(handle.write).toHaveBeenCalledWith("Y\r");
    expect(result.permissionsRequested).toBe(1);
    expect(result.permissionsAccepted).toBe(1);
  });

  it("handles denied permission", async () => {
    const handle = createMockHandle();
    const deps: InteractiveRunnerDeps = {
      spawnPty: vi.fn().mockReturnValue(handle),
      stripAnsi,
      detectPermission: detectPtyPermission,
    };
    const onPermission = vi.fn().mockResolvedValue("deny");
    const resultPromise = runInteractiveMode(
      { prompt: "risky op", projectDir: "/tmp", timeoutMs: 60_000 },
      deps,
      vi.fn(),
      onPermission,
    );

    handle.emitData("Run dangerous command?\n");
    handle.emitData("  Accept  Deny\n");
    await new Promise((r) => setTimeout(r, 50));
    handle.emitExit(0);

    const result = await resultPromise;
    expect(handle.write).toHaveBeenCalledWith("n\r");
    expect(result.permissionsDenied).toBe(1);
  });
});
