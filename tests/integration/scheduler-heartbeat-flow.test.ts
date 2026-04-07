import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHeartbeatRunner } from "../../packages/ai-agent/src/scheduler/heartbeat-runner.js";
import type { HeartbeatConfig } from "@closeclaw/shared-types";

function makeConfig(): HeartbeatConfig {
  return { enabled: true, every: "1s", target: "last" };
}

describe("heartbeat lifecycle integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start -> fire -> suppress OK -> stop", async () => {
    const delivered: string[] = [];
    let callCount = 0;
    const processMessage = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount === 1 ? "Alert: deploy failed!" : "HEARTBEAT_OK";
    });
    const sendMessage = vi.fn().mockImplementation(async (text: string) => {
      delivered.push(text);
    });
    const readFile = vi.fn().mockReturnValue("- check deploys");

    const runner = createHeartbeatRunner(
      makeConfig(),
      processMessage,
      sendMessage,
      readFile,
    );

    runner.start();
    expect(runner.isRunning()).toBe(true);

    await vi.advanceTimersByTimeAsync(1100);
    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(delivered).toEqual(["Alert: deploy failed!"]);

    await vi.advanceTimersByTimeAsync(1000);
    expect(processMessage).toHaveBeenCalledTimes(2);
    expect(delivered).toEqual(["Alert: deploy failed!"]);

    runner.stop();
    expect(runner.isRunning()).toBe(false);

    await vi.advanceTimersByTimeAsync(2000);
    expect(processMessage).toHaveBeenCalledTimes(2);
  });

  it("runNow works even when not started", async () => {
    const processMessage = vi.fn().mockResolvedValue("Urgent!");
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockReturnValue("- check stuff");

    const runner = createHeartbeatRunner(
      makeConfig(),
      processMessage,
      sendMessage,
      readFile,
    );

    expect(runner.isRunning()).toBe(false);
    await runner.runNow();
    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith("Urgent!");
  });

  it("handles errors without crashing the runner", async () => {
    let callCount = 0;
    const processMessage = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error("API down");
      return "Recovered alert";
    });
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const readFile = vi.fn().mockReturnValue("- check");

    const runner = createHeartbeatRunner(
      makeConfig(),
      processMessage,
      sendMessage,
      readFile,
    );

    runner.start();
    await vi.advanceTimersByTimeAsync(1100);
    expect(sendMessage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    expect(sendMessage).toHaveBeenCalledWith("Recovered alert");

    runner.stop();
  });
});
