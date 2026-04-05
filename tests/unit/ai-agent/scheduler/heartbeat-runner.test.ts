import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHeartbeatRunner } from "../../../../packages/ai-agent/src/scheduler/heartbeat-runner.js";
import type { HeartbeatConfig } from "@closeclaw/shared-types";

function makeConfig(overrides?: Partial<HeartbeatConfig>): HeartbeatConfig {
  return {
    enabled: true,
    every: "1s",
    target: "last",
    ...overrides,
  };
}

function makeDeps() {
  const processMessage = vi.fn().mockResolvedValue("Something to report");
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  const readHeartbeatFile = vi.fn().mockReturnValue("- Check stuff");
  return { processMessage, sendMessage, readHeartbeatFile };
}

describe("createHeartbeatRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts and reports running", () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    expect(runner.isRunning()).toBe(false);
    runner.start();
    expect(runner.isRunning()).toBe(true);
    runner.stop();
    expect(runner.isRunning()).toBe(false);
  });

  it("fires heartbeat on interval", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.processMessage).toHaveBeenCalled();
    runner.stop();
  });

  it("delivers response to sendMessage", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.sendMessage).toHaveBeenCalledWith("Something to report");
    runner.stop();
  });

  it("suppresses HEARTBEAT_OK response", async () => {
    const deps = makeDeps();
    deps.processMessage.mockResolvedValue("HEARTBEAT_OK");
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.sendMessage).not.toHaveBeenCalled();
    runner.stop();
  });

  it("suppresses HEARTBEAT_OK at end of response", async () => {
    const deps = makeDeps();
    deps.processMessage.mockResolvedValue("All clear\nHEARTBEAT_OK");
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.sendMessage).not.toHaveBeenCalled();
    runner.stop();
  });

  it("skips when heartbeat file is missing", async () => {
    const deps = makeDeps();
    deps.readHeartbeatFile.mockReturnValue(undefined);
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.processMessage).not.toHaveBeenCalled();
    runner.stop();
  });

  it("skips when target is none", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig({ target: "none" }),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.processMessage).not.toHaveBeenCalled();
    runner.stop();
  });

  it("respects active hours - inside window", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig({ activeHours: { start: "00:00", end: "23:59" } }),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.processMessage).toHaveBeenCalled();
    runner.stop();
  });

  it("respects active hours - outside window", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig({ activeHours: { start: "23:58", end: "23:59" } }),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.processMessage).not.toHaveBeenCalled();
    runner.stop();
  });

  it("runNow fires immediately", async () => {
    const deps = makeDeps();
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    await runner.runNow();
    expect(deps.processMessage).toHaveBeenCalled();
    expect(deps.sendMessage).toHaveBeenCalledWith("Something to report");
  });

  it("handles processMessage errors gracefully", async () => {
    const deps = makeDeps();
    deps.processMessage.mockRejectedValue(new Error("AI down"));
    const runner = createHeartbeatRunner(
      makeConfig(),
      deps.processMessage,
      deps.sendMessage,
      deps.readHeartbeatFile,
    );
    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(deps.sendMessage).not.toHaveBeenCalled();
    runner.stop();
  });
});
