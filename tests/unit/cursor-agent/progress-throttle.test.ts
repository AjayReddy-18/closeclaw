import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createProgressThrottle } from "@closeclaw/cursor-agent";

describe("createProgressThrottle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first message immediately", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.onOutput("Step 1 done");
    expect(send).toHaveBeenCalledWith("Step 1 done");
  });

  it("suppresses messages within the throttle window", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.onOutput("Step 1");
    throttle.onOutput("Step 2");
    throttle.onOutput("Step 3");
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("allows a message after the throttle window", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.onOutput("Step 1");
    vi.advanceTimersByTime(11_000);
    throttle.onOutput("Step 2");
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("sends heartbeat after silence period", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.startHeartbeat();
    vi.advanceTimersByTime(61_000);
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining("Still working"),
    );
    throttle.stopHeartbeat();
  });

  it("resets heartbeat timer on output", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.startHeartbeat();
    vi.advanceTimersByTime(50_000);
    throttle.onOutput("progress");
    vi.advanceTimersByTime(50_000);
    const heartbeatCalls = send.mock.calls.filter(
      (c: string[]) =>
        typeof c[0] === "string" && c[0].includes("Still working"),
    );
    expect(heartbeatCalls).toHaveLength(0);
    throttle.stopHeartbeat();
  });

  it("stops heartbeat cleanly", () => {
    const send = vi.fn();
    const throttle = createProgressThrottle(send, 10_000, 60_000);
    throttle.startHeartbeat();
    throttle.stopHeartbeat();
    vi.advanceTimersByTime(120_000);
    const heartbeatCalls = send.mock.calls.filter(
      (c: string[]) =>
        typeof c[0] === "string" && c[0].includes("Still working"),
    );
    expect(heartbeatCalls).toHaveLength(0);
  });
});
