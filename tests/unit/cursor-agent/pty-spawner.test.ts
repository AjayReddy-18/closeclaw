import { describe, it, expect, vi } from "vitest";
import { createPtySpawner } from "@closeclaw/cursor-agent";

function createMockPtyModule() {
  const onDataCb: ((data: string) => void)[] = [];
  const onExitCb: ((info: { exitCode: number }) => void)[] = [];
  const mockProcess = {
    onData: vi.fn((cb: (data: string) => void) => {
      onDataCb.push(cb);
      return { dispose: vi.fn() };
    }),
    onExit: vi.fn((cb: (info: { exitCode: number }) => void) => {
      onExitCb.push(cb);
      return { dispose: vi.fn() };
    }),
    write: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
  };
  const spawnFn = vi.fn().mockReturnValue(mockProcess);
  return { spawnFn, mockProcess, onDataCb, onExitCb };
}

describe("createPtySpawner", () => {
  it("spawns a process with the given options", () => {
    const { spawnFn } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    spawner({
      binary: "/usr/local/bin/cursor-agent",
      args: ["hello world"],
      cwd: "/tmp/project",
      cols: 100,
      rows: 30,
    });
    expect(spawnFn).toHaveBeenCalledWith(
      "/usr/local/bin/cursor-agent",
      ["hello world"],
      expect.objectContaining({ cwd: "/tmp/project", cols: 100, rows: 30 }),
    );
  });

  it("uses default cols and rows when not provided", () => {
    const { spawnFn } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    spawner({
      binary: "/usr/local/bin/cursor-agent",
      args: [],
      cwd: "/tmp",
    });
    expect(spawnFn).toHaveBeenCalledWith(
      "/usr/local/bin/cursor-agent",
      [],
      expect.objectContaining({ cols: 120, rows: 40 }),
    );
  });

  it("relays onData events from the PTY process", () => {
    const { spawnFn, onDataCb } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    const handle = spawner({
      binary: "agent",
      args: [],
      cwd: "/tmp",
    });
    const received: string[] = [];
    handle.onData((data) => received.push(data));
    onDataCb[0]("hello output");
    expect(received).toEqual(["hello output"]);
  });

  it("relays onExit events from the PTY process", () => {
    const { spawnFn, onExitCb } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    const handle = spawner({
      binary: "agent",
      args: [],
      cwd: "/tmp",
    });
    const exitCodes: number[] = [];
    handle.onExit((info) => exitCodes.push(info.exitCode));
    onExitCb[0]({ exitCode: 0 });
    expect(exitCodes).toEqual([0]);
  });

  it("forwards write calls to the PTY process", () => {
    const { spawnFn, mockProcess } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    const handle = spawner({
      binary: "agent",
      args: [],
      cwd: "/tmp",
    });
    handle.write("Y\r");
    expect(mockProcess.write).toHaveBeenCalledWith("Y\r");
  });

  it("forwards kill calls to the PTY process", () => {
    const { spawnFn, mockProcess } = createMockPtyModule();
    const spawner = createPtySpawner(spawnFn);
    const handle = spawner({
      binary: "agent",
      args: [],
      cwd: "/tmp",
    });
    handle.kill();
    expect(mockProcess.kill).toHaveBeenCalled();
  });
});
