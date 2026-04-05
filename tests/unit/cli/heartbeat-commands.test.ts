import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHeartbeatConfigure } from "../../../packages/cli/src/commands/heartbeat-configure.js";
import { runHeartbeatStatus } from "../../../packages/cli/src/commands/heartbeat-status.js";
import type { Configuration, HeartbeatConfig } from "@closeclaw/shared-types";

function makeConfig(heartbeat?: HeartbeatConfig): Configuration {
  return {
    version: "1.0.0",
    bots: [],
    agent: { provider: "anthropic", model: "test", apiKey: "k" },
    ...(heartbeat ? { heartbeat } : {}),
  } as Configuration;
}

let consoleSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("heartbeat configure", () => {
  it("sets heartbeat on config with defaults", async () => {
    const config = makeConfig();
    const writeFn = vi.fn();
    await runHeartbeatConfigure({
      readConfig: () => config,
      writeConfig: writeFn,
      prompt: vi.fn().mockResolvedValue("30m"),
      confirmPrompt: vi.fn().mockResolvedValue(false),
      selectPrompt: vi.fn().mockResolvedValue("last"),
    });
    expect(writeFn).toHaveBeenCalledTimes(1);
    const saved = writeFn.mock.calls[0][0] as Configuration;
    expect(saved.heartbeat?.enabled).toBe(true);
    expect(saved.heartbeat?.every).toBe("30m");
    expect(saved.heartbeat?.target).toBe("last");
  });

  it("sets active hours when user opts in", async () => {
    const config = makeConfig();
    const writeFn = vi.fn();
    const inputFn = vi
      .fn()
      .mockResolvedValueOnce("1h")
      .mockResolvedValueOnce("08:00")
      .mockResolvedValueOnce("20:00");
    await runHeartbeatConfigure({
      readConfig: () => config,
      writeConfig: writeFn,
      prompt: inputFn,
      confirmPrompt: vi.fn().mockResolvedValue(true),
      selectPrompt: vi.fn().mockResolvedValue("none"),
    });
    const saved = writeFn.mock.calls[0][0] as Configuration;
    expect(saved.heartbeat?.activeHours).toEqual({
      start: "08:00",
      end: "20:00",
    });
    expect(saved.heartbeat?.target).toBe("none");
  });

  it("shows error when config is missing", async () => {
    await runHeartbeatConfigure({
      readConfig: () => null,
      writeConfig: vi.fn(),
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not found"),
    );
  });
});

describe("heartbeat status", () => {
  it("shows disabled when no heartbeat config", () => {
    runHeartbeatStatus({ readConfig: () => makeConfig() });
    expect(consoleSpy).toHaveBeenCalledWith("Heartbeat: disabled");
  });

  it("shows disabled when heartbeat is not enabled", () => {
    runHeartbeatStatus({
      readConfig: () =>
        makeConfig({ enabled: false, every: "30m", target: "last" }),
    });
    expect(consoleSpy).toHaveBeenCalledWith("Heartbeat: disabled");
  });

  it("shows heartbeat details when enabled", () => {
    runHeartbeatStatus({
      readConfig: () =>
        makeConfig({
          enabled: true,
          every: "1h",
          target: "last",
          activeHours: { start: "09:00", end: "22:00" },
          timezone: "America/New_York",
        }),
    });
    expect(consoleSpy).toHaveBeenCalledWith("Heartbeat: enabled");
    expect(consoleSpy).toHaveBeenCalledWith("  Interval: 1h");
    expect(consoleSpy).toHaveBeenCalledWith("  Target: last");
    expect(consoleSpy).toHaveBeenCalledWith(
      "  Active hours: 09:00 - 22:00",
    );
    expect(consoleSpy).toHaveBeenCalledWith("  Timezone: America/New_York");
  });

  it("shows error when config is missing", () => {
    runHeartbeatStatus({ readConfig: () => null });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not found"),
    );
  });
});
